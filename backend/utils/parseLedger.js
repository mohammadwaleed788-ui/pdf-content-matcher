import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat.js";
import { extractTextWithOCR } from "./ocrHelper.js";

dayjs.extend(customParseFormat);

const SKIP_PATTERNS = [
  /carried over|brought forward/i,
  /b\/f|c\/f/i,
  /opening balance|closing balance/i,
  /page\s+\d+|fimex|book:/i,
  /^\s*$/,
];


function extractChequeNumber(desc) {
  const m = desc.match(/[I]?Cheque\s+N(?:o\.?|:)?\s*[:'.]?\s*[0']*(\d{4,})/i);
  return m ? m[1].replace(/^0+/, "") : null;
}

export const parseLedgerPDF = async (filePath) => {
  console.log("📑 Starting ledger PDF OCR extraction...");
  const rawText = await extractTextWithOCR(filePath);

  // BUG 6 FIX: Remove form-feed page-break characters
  const cleaned = rawText.replace(/\f/g, "\n");
  const lines = cleaned.split("\n");

  const transactions = [];

  let currentDate = null;

  const datedTxnRe =
    /^(\d{1,2}-\d{1,2}-\d{4})\s+(Dr|Cr)\s+(.+?)\s+Journal\s+\d+\s+cd\s+([\d,]+(?:\.\d+)?)\s*$/;

  const noDateTxnRe =
    /^\s+(Dr|Cr)\s+(.+?)\s+Journal\s+\d+\s+cd\s+([\d,]+(?:\.\d+)?)\s*$/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) continue;
    if (SKIP_PATTERNS.some((p) => p.test(trimmed))) continue;

    let drCr = null;
    let accountName = null;
    let amountStr = null;

    // Try dated line first
    const m1 = datedTxnRe.exec(trimmed);
    if (m1) {
      const parsedDate = dayjs(m1[1], ["D-M-YYYY", "D-MM-YYYY", "DD-MM-YYYY"], true);
      if (parsedDate.isValid()) {
        currentDate = parsedDate.format("YYYY-MM-DD");
      }
      drCr = m1[2];
      accountName = m1[3].trim();
      amountStr = m1[4];
    } else {
      // Try no-date line (uses `line` not `trimmed` to check leading whitespace)
      const m2 = noDateTxnRe.exec(line);
      if (m2) {
        drCr = m2[1];
        accountName = m2[2].trim();
        amountStr = m2[3];
      }
    }

    if (!drCr || !amountStr || !currentDate) continue;

    // BUG 4 FIX: only discard zero/negative amounts; allow small valid amounts
    const amount = parseFloat(amountStr.replace(/,/g, ""));
    if (isNaN(amount) || amount <= 0) continue;

    // BUG 5 FIX: look ahead for description / cheque number on following lines
    const descParts = [];
    for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
      const next = lines[j].trim();
      if (!next) continue;
      // Stop if we hit another Journal transaction line or a new date
      if (/Journal\s+\d+/.test(next)) break;
      if (/^\d{1,2}-\d{1,2}-\d{4}/.test(next)) break;
      // Skip exchange rate lines (start with $ or contain @)
      if (/^\$/.test(next) || /@\s*\$/.test(next)) continue;
      descParts.push(next);
    }

    const description = descParts.join(" ").trim();
    const chequeNo = extractChequeNumber(description);

    // Build narration: account name + cheque reference or short description
    let narration = accountName;
    if (chequeNo) {
      narration += ` Cheque No: ${chequeNo}`;
    } else if (description.length > 4) {
      // Append a brief description excerpt to aid fuzzy narration matching
      narration += " - " + description.slice(0, 60).replace(/\s+/g, " ").trim();
    }

    narration = narration.replace(/\s+/g, " ").trim();
    if (!narration || narration.length < 2) continue;

    const isCredit = drCr === "Cr";

    transactions.push({
      date: currentDate,
      debit:  isCredit ? 0      : amount,
      credit: isCredit ? amount : 0,
      narration,
    });
  }

  console.log(`✅ Ledger parser extracted ${transactions.length} transactions`);
  return transactions;
};