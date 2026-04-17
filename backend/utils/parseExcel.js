import ExcelJS from "exceljs";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat.js";

dayjs.extend(customParseFormat);

const HEADER_KEYWORDS = {
  type: /^type$/i,
  date: /^date$/i,
  num: /^num$/i,
  name: /^name$/i,
  memo: /^memo$/i,
  description: /^(description|details?|narration|particulars)$/i,
  debit: /^(debit|withdrawals?)$/i,
  credit: /^(credit|lodgements?|deposits?)$/i,
  balance: /^balance$/i,
  split: /^split$/i,
  class: /^class$/i,
};

const SKIP_ROW_KEYWORDS = [/^total/i, /^grand\s+total/i];

function cellToString(cell) {
  if (cell === null || cell === undefined) return "";
  if (cell instanceof Date) return cell.toISOString();
  if (typeof cell === "object" && cell.text) return cell.text;
  if (typeof cell === "object" && cell.result !== undefined)
    return String(cell.result);
  return String(cell).trim();
}

function cellToNumber(cell) {
  if (cell === null || cell === undefined) return 0;
  if (typeof cell === "number") return cell;
  if (typeof cell === "object" && cell.result !== undefined) {
    const n = parseFloat(cell.result);
    return isNaN(n) ? 0 : n;
  }
  const n = parseFloat(String(cell).replace(/,/g, ""));
  return isNaN(n) ? 0 : n;
}

function cellToDate(cell) {
  if (!cell) return null;

  if (cell instanceof Date) {
    const d = dayjs(cell);
    return d.isValid() ? d : null;
  }

  const str = cellToString(cell);
  if (!str) return null;

  if (/GMT|UTC|T\d{2}:/.test(str)) {
    const d = dayjs(new Date(str));
    return d.isValid() ? d : null;
  }

  const formats = [
    "DD-MMM-YYYY", "D-MMM-YYYY",
    "DD/MM/YYYY", "D/M/YYYY",
    "DD-MM-YYYY", "D-M-YYYY",
    "YYYY-MM-DD", "MM/DD/YYYY",
  ];
  for (const f of formats) {
    const d = dayjs(str, f, true);
    if (d.isValid()) return d;
  }

  const d = dayjs(str);
  return d.isValid() ? d : null;
}

// ─── Find the right worksheet ────────────────────────────────────────────────

function findDataSheet(workbook) {
  let best = null;
  workbook.eachSheet((ws) => {
    if (ws.columnCount > 0 && (!best || ws.rowCount > best.rowCount)) {
      best = ws;
    }
  });
  return best;
}

// ─── Find header row and map columns ─────────────────────────────────────────

function detectHeaderRow(sheet) {
  const maxScan = Math.min(sheet.rowCount, 15);

  for (let r = 1; r <= maxScan; r++) {
    const row = sheet.getRow(r);
    const matched = {};
    let matchCount = 0;

    for (let c = 1; c <= sheet.columnCount; c++) {
      const val = cellToString(row.getCell(c).value).trim();
      if (!val) continue;

      for (const [key, regex] of Object.entries(HEADER_KEYWORDS)) {
        if (regex.test(val) && !matched[key]) {
          matched[key] = c;
          matchCount++;
          break;
        }
      }
    }

    if (matchCount >= 3 && (matched.date || matched.debit || matched.credit)) {
      return { rowIdx: r, columns: matched };
    }
  }

  return null;
}

// ─── Main Export ─────────────────────────────────────────────────────────────

export const parseExcel = async (filePath) => {
  console.log("📑 Starting dynamic Excel extraction...");

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const sheet = findDataSheet(workbook);
  if (!sheet) throw new Error("No data sheet found in the workbook");

  console.log(
    `📋 Using sheet "${sheet.name}" (${sheet.rowCount} rows, ${sheet.columnCount} cols)`
  );

  const header = detectHeaderRow(sheet);
  if (!header) throw new Error("Could not detect header row in the spreadsheet");

  const cols = header.columns;
  console.log(`📊 Header at row ${header.rowIdx}:`, JSON.stringify(cols));

  const transactions = [];

  for (let r = header.rowIdx + 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);

    const firstCellText = cellToString(
      row.getCell(1).value || row.getCell(2).value
    );
    if (SKIP_ROW_KEYWORDS.some((re) => re.test(firstCellText))) continue;

    const rawDebit = cols.debit ? cellToNumber(row.getCell(cols.debit).value) : 0;
    const rawCredit = cols.credit
      ? cellToNumber(row.getCell(cols.credit).value)
      : 0;
    if (rawDebit === 0 && rawCredit === 0) continue;

    const dateCell = cols.date ? row.getCell(cols.date).value : null;
    const date = cellToDate(dateCell);
    if (!date) continue;

    const namePart = cols.name
      ? cellToString(row.getCell(cols.name).value)
      : "";
    const memoPart = cols.memo
      ? cellToString(row.getCell(cols.memo).value)
      : "";
    const descPart = cols.description
      ? cellToString(row.getCell(cols.description).value)
      : "";

    let narration = [namePart, memoPart, descPart]
      .filter(Boolean)
      .join(" - ")
      .replace(/\s+/g, " ")
      .trim();

    if (!narration) {
      const typePart = cols.type
        ? cellToString(row.getCell(cols.type).value)
        : "";
      narration = typePart || "Unknown";
    }

    transactions.push({
      date: date.format("YYYY-MM-DD"),
      narration,
      debit: Math.abs(rawDebit),
      credit: Math.abs(rawCredit),
    });
  }

  console.log(`✅ Excel parser extracted ${transactions.length} transactions`);
  return transactions;
};
