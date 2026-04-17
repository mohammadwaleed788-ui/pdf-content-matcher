import ExcelJS from "exceljs";

export const generateExcel = async (results, filePath) => {
  const workbook = new ExcelJS.Workbook();

  const bankSheet = workbook.addWorksheet("Only in Bank");
  const ledgerSheet = workbook.addWorksheet("Only in Ledger");

  const commonColumns = [
    { header: "Date", key: "date", width: 15 },
    { header: "Narration", key: "narration", width: 30 },
    { header: "Debit", key: "debit", width: 15 },
    { header: "Credit", key: "credit", width: 15 },
  ];

  bankSheet.columns = commonColumns;
  ledgerSheet.columns = commonColumns;

  results.unmatchedBank.forEach((b) => {
    bankSheet.addRow({
      date: b.date,
      narration: b.narration,
      debit: b.debit || "",
      credit: b.credit || "",
    });
  });

  results.unmatchedLedger.forEach((l) => {
    ledgerSheet.addRow({
      date: l.date,
      narration: l.narration,
      debit: l.debit || "",
      credit: l.credit || "",
    });
  });

  await workbook.xlsx.writeFile(filePath);
};
