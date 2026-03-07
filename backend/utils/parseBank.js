import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat.js";
import { extractTextWithOCR } from "./ocrHelper.js";

dayjs.extend(customParseFormat);

const SKIP_PATTERNS = [
  /statement of account/i,
  /customer service|email:/i,
  /this statement was generated/i,
  /name\s+s&s|account (class|number|period|branch)/i,
  /currency|opening balance|closing balance|available balance/i,
  /post date.*value date.*narration.*debit.*credit.*balance/i,
  /page\s+\d+|fimex|ring road branch|uncleared|blocked/i,
  /statement period/i,
];

export const parseBankPDF = async (filePath) => {
  console.log("📑 Starting bank PDF OCR extraction...");
  const rawText = await extractTextWithOCR(filePath);

  const cleaned = rawText.replace(/\f/g, "\n");
  const lines = cleaned.split("\n");

  const MONTH_PAT = "Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec";
  const splitDateRe = new RegExp(`(\\d{1,2}-(?:${MONTH_PAT})-)`, "g");

  const stitchedLines = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    const partialDates = [...trimmed.matchAll(splitDateRe)].map((m) => m[1]);
    const hasYear = /\d{4}/.test(trimmed);

    const isPartialDateLine =
      partialDates.length > 0 &&
      !hasYear &&
      trimmed.replace(/[\s\d\-A-Za-z]/g, "").length === 0;

    if (isPartialDateLine && i + 1 < lines.length) {
      const year = "2025";
      const postDate = partialDates[0] + year;
      const valueDate = partialDates[1] ? partialDates[1] + year : postDate;
      const nextLine = lines[i + 1].trim();
      stitchedLines.push(`${postDate}   ${valueDate}   ${nextLine}`);
      i += 2;
      continue;
    }

    stitchedLines.push(line);
    i++;
  }

  const transactions = [];
  const DATE_FORMATS = ["D-MMM-YYYY", "DD-MMM-YYYY"];
  const dateStartRe = /^(\d{1,2}-[A-Za-z]{3}-\d{4})/;

  const monetaryNumRe = /(-?[\d,]+\.\d+)/g;

  for (const line of stitchedLines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 20) continue;
    if (SKIP_PATTERNS.some((p) => p.test(trimmed))) continue;

    const dateMatch = trimmed.match(dateStartRe);
    if (!dateMatch) continue;

    const date = dayjs(dateMatch[1], DATE_FORMATS, true);
    if (!date.isValid()) continue;

    const allNums = [...trimmed.matchAll(monetaryNumRe)].map((m) => ({
      pos: m.index,
      val: parseFloat(m[1].replace(/,/g, "")),
      raw: m[1],
    }));

    if (allNums.length < 2) continue;

    const balanceEntry = allNums[allNums.length - 1];
    let debit = 0;
    let credit = 0;
    let narrationEndPos;

    if (allNums.length >= 3) {
      const debitEntry  = allNums[allNums.length - 3];
      const creditEntry = allNums[allNums.length - 2];
      debit  = debitEntry.val  > 0 ? debitEntry.val  : 0;
      credit = creditEntry.val > 0 ? creditEntry.val : 0;
      narrationEndPos = debitEntry.pos;
    } else {
      const amtEntry = allNums[allNums.length - 2];
      const rawAmt = amtEntry.val;

      
      const amtEndPos = amtEntry.pos + amtEntry.raw.length;
      const gap = balanceEntry.pos - amtEndPos;

      if (rawAmt < 0) {

        debit  = 0;
        credit = 0;
      } else if (gap > 8) {
        debit  = rawAmt;
        credit = 0;
      } else {
        debit  = 0;
        credit = rawAmt;
      }

      narrationEndPos = amtEntry.pos;
    }

    if (debit === 0 && credit === 0) continue;

    // Extract narration: text after the value-date field, before the amounts
    const rest = trimmed.slice(dateMatch[1].length);
    const secondDateMatch = rest.match(/\s+(\d{1,2}-[A-Za-z]{3}-\d{4})/);
    const narrationStart =
      dateMatch[1].length + (secondDateMatch ? secondDateMatch[0].length : 0);

    const narration = trimmed
      .slice(narrationStart, narrationEndPos)
      .replace(/\s+/g, " ")
      .trim();

    if (!narration || narration.length < 3 || !/[a-zA-Z]/.test(narration)) continue;

    transactions.push({
      date: date.format("YYYY-MM-DD"),
      debit,
      credit,
      narration,
    });
  }

  // Deduplicate exact duplicates that OCR may produce across page overlaps
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

  console.log(`✅ Bank parser extracted ${unique.length} transactions`);
  return unique;
};