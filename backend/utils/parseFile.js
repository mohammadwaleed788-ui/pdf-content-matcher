import path from "path";
import { parsePdfDynamic } from "./parsePdfDynamic.js";
import { parseExcel } from "./parseExcel.js";

const SUPPORTED_PDF = [".pdf"];
const SUPPORTED_EXCEL = [".xlsx", ".xlsm", ".xls"];

export async function parseFile(filePath, originalName) {
  const ext = path.extname(originalName || filePath).toLowerCase();

  if (SUPPORTED_PDF.includes(ext)) {
    return parsePdfDynamic(filePath);
  }

  if (SUPPORTED_EXCEL.includes(ext)) {
    return parseExcel(filePath);
  }

  throw new Error(
    `Unsupported file type "${ext}". Accepted: ${[...SUPPORTED_PDF, ...SUPPORTED_EXCEL].join(", ")}`
  );
}
