import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat.js";
import { extractTextWithOCR } from "./ocrHelper.js";

dayjs.extend(customParseFormat);

const DATE_FORMATS = [
  "DD-MMM-YYYY", "D-MMM-YYYY",
  "DD/MM/YYYY", "D/M/YYYY",
  "DD-MM-YYYY", "D-M-YYYY",
  "YYYY-MM-DD",
];

const SKIP_LINE = [
  /opening\s+balance/i,
  /closing\s+balance/i,
  /--\s*\d+\s+of\s+\d+\s*--/,
  /^void$/i,
  /^not\s+for\s+presentation$/i,
  /statement\s+of\s+account/i,
  /account\s+statement\s+summary/i,
  /summary\s+statement/i,
  /customer\s+service/i,
  /private\s+&\s+confidential/i,
  /account\s+(name|no\.?|number)/i,
  /total\s*(withdrawal|lodgement|debit|credit)/i,
  /currency\s+\w{3}/i,
  /available\s+to\s+withdraw/i,
  /uncleared\s+balance/i,
  /total\s*lodgements?/i,
  /total\s*withdraw/i,
];

const DATE_LINE_RE =
  /^(\d{1,2}[-/][A-Za-z]{3,9}[-/]\d{2,4}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{4}[-/]\d{1,2}[-/]\d{1,2})/;

function tryParseDate(s) {
  if (!s) return null;
  let t = s.trim();
  t = t.replace(/[A-Za-z]{3,}/g, (m) =>
    m.charAt(0).toUpperCase() + m.slice(1).toLowerCase()
  );
  for (const f of DATE_FORMATS) {
    const d = dayjs(t, f, true);
    if (d.isValid()) return d;
  }
  return null;
}

// ─── Header Detection ────────────────────────────────────────────────────────

const AMOUNT_HEADERS = [
  { role: "debit", re: /withdrawals?|debit/i },
  { role: "credit", re: /lodgements?|credits?|deposits?/i },
  { role: "balance", re: /balance/i },
];

function detectHeader(lines) {
  for (let i = 0; i < Math.min(lines.length, 60); i++) {
    const line = lines[i];
    if (!/\bdate\b/i.test(line)) continue;

    let found = 0;
    const cols = {};
    for (const hdr of AMOUNT_HEADERS) {
      const m = line.match(hdr.re);
      if (m) {
        found++;
        cols[hdr.role] = line.indexOf(m[0]);
      }
    }
    if (found >= 2) {
      return { lineIdx: i, columns: cols, raw: line };
    }
  }
  return null;
}

function classifyAmount(charPos, columns) {
  let best = null;
  let bestDist = Infinity;
  for (const [role, startPos] of Object.entries(columns)) {
    const dist = Math.abs(charPos - startPos);
    if (dist < bestDist) {
      bestDist = dist;
      best = role;
    }
  }
  return best;
}

// ─── OCR Cleaning ────────────────────────────────────────────────────────────

function cleanOcrLine(line) {
  return line.replace(/\|/g, " ").replace(/\[/g, " ");
}

/**
 * Find all monetary amounts in a line.
 * Handles OCR artifacts: leading `(` means debit (accounting negative convention).
 * Uses lookahead to avoid matching partial numbers (e.g. 13.600 exchange rates).
 */
function extractAmounts(line) {
  const cleaned = cleanOcrLine(line);
  const results = [];
  const re = /\(?(-?[\d,]+\.\d{2})(?=\)?(?:[^\d.]|$))/g;
  let m;
  while ((m = re.exec(cleaned)) !== null) {
    const prefix = cleaned.substring(Math.max(0, m.index - 4), m.index);
    if (prefix.includes("@")) continue;
    const isParenDebit =
      cleaned[m.index] === "(" ||
      m[1].startsWith("-");
    const value = Math.abs(parseFloat(m[1].replace(/,/g, "")));
    if (value === 0) continue;
    results.push({
      value,
      pos: m.index,
      raw: m[1],
      isParenDebit,
    });
  }
  return results;
}

// ─── Main Export ─────────────────────────────────────────────────────────────

export const parsePdfDynamic = async (filePath) => {
  console.log("📑 Starting dynamic PDF extraction...");
  const rawText = await extractTextWithOCR(filePath);
  const lines = rawText.replace(/\f/g, "\n").split("\n");

  const header = detectHeader(lines);
  const startLine = header ? header.lineIdx + 1 : 0;
  const columns = header ? header.columns : null;

  if (header) {
    console.log(`📋 Header at line ${header.lineIdx}: ${header.raw.trim()}`);
    console.log(`📊 Columns: ${JSON.stringify(columns)}`);
  } else {
    console.log("⚠️ No header detected, using heuristic parsing");
  }

  const blocks = [];
  let current = null;

  for (let i = startLine; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = cleanOcrLine(raw).trim();
    if (!trimmed) continue;
    if (SKIP_LINE.some((p) => p.test(trimmed))) continue;
    if (detectHeader([trimmed])) continue;

    const dateMatch = trimmed.match(DATE_LINE_RE);
    if (dateMatch && tryParseDate(dateMatch[1])) {
      if (current) blocks.push(current);
      current = { datePart: dateMatch[1], lines: [raw] };
    } else if (current) {
      current.lines.push(raw);
    }
  }
  if (current) blocks.push(current);

  const transactions = [];
  for (const block of blocks) {
    const txn = parseBlock(block, columns);
    if (txn) transactions.push(txn);
  }

  const unique = transactions.filter(
    (txn, idx, self) =>
      idx ===
      self.findIndex(
        (t) =>
          t.date === txn.date &&
          t.narration === txn.narration &&
          t.debit === txn.debit &&
          t.credit === txn.credit
      )
  );

  console.log(`✅ Dynamic PDF parser extracted ${unique.length} transactions`);
  return unique;
};

// ─── Block → Transaction ─────────────────────────────────────────────────────

function parseBlock(block, columns) {
  const date = tryParseDate(block.datePart);
  if (!date) return null;

  const amounts = [];
  for (const line of block.lines) {
    amounts.push(...extractAmounts(line));
  }

  if (amounts.length < 2) return null;

  let debit = 0;
  let credit = 0;
  const balance = amounts[amounts.length - 1];

  if (columns) {
    for (let i = 0; i < amounts.length - 1; i++) {
      const role = classifyAmount(amounts[i].pos, columns);
      const val = amounts[i].value;
      if (role === "debit") debit += val;
      else if (role === "credit") credit += val;
    }
  } else {
    // Heuristic mode (OCR / no header)
    const txnAmounts = amounts.slice(0, -1);

    if (txnAmounts.length >= 2) {
      for (const a of txnAmounts) {
        if (a.isParenDebit) debit += a.value;
        else credit += a.value;
      }
      if (debit === 0 && credit > 0 && txnAmounts.length === 2) {
        debit = txnAmounts[0].value;
        credit = txnAmounts[1].value;
      }
    } else if (txnAmounts.length === 1) {
      const amt = txnAmounts[0];
      if (amt.isParenDebit) {
        debit = amt.value;
      } else {
        const gap =
          balance.pos - (amt.pos + amt.raw.length);
        if (gap > 15) debit = amt.value;
        else credit = amt.value;
      }
    }
  }

  if (debit < 0) {
    credit += Math.abs(debit);
    debit = 0;
  }
  if (credit < 0) {
    debit += Math.abs(credit);
    credit = 0;
  }
  if (debit === 0 && credit === 0) return null;

  const narration = buildNarration(block);
  if (!narration || narration.length < 2) return null;

  return { date: date.format("YYYY-MM-DD"), narration, debit, credit };
}

function buildNarration(block) {
  const parts = [];
  for (let i = 0; i < block.lines.length; i++) {
    let text = cleanOcrLine(block.lines[i]);

    if (i === 0) {
      const idx = text.indexOf(block.datePart);
      if (idx >= 0) text = text.slice(idx + block.datePart.length);
    }

    text = text.replace(/\(?(-?[\d,]+\.\d{2})\)?/g, " ");
    text = text.replace(
      /\b\d{1,2}[-/][A-Za-z]{3,9}[-/]\d{2,4}\b/g,
      " "
    );
    text = text.replace(/\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/g, " ");
    text = text.replace(/\b\d{2,}[0-9A-Z]{8,}\b/g, " ");
    text = text.replace(/\b[0-9A-Z]{12,}\b/g, " ");
    text = text.replace(/[()[\]]/g, " ");
    text = text.replace(/\s+/g, " ").trim();

    if (text && text.length > 1 && /[a-zA-Z]/.test(text)) {
      parts.push(text);
    }
  }

  return parts.join(" ").replace(/\s+/g, " ").trim();
}
