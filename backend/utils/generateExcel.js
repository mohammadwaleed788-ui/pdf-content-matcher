import ExcelJS from "exceljs";

export const generateExcel = async (results, filePath) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Reconciliation");

  sheet.columns = [
    { header: "Bank Date", key: "bankDate", width: 15 },
    { header: "Bank Narration", key: "bankNarration", width: 30 },
    { header: "Bank Amount", key: "bankAmount", width: 15 },
    // { header: "Ledger Date", key: "ledgerDate", width: 15 },
    // { header: "Ledger Narration", key: "ledgerNarration", width: 30 },
    // { header: "Ledger Amount", key: "ledgerAmount", width: 15 },
    { header: "Status", key: "status", width: 15 },
  ];

  // results.matches.forEach((m) => {
  //   sheet.addRow({
  //     bankDate: m.bank.date,
  //     bankNarration: m.bank.narration,
  //     bankAmount: m.bank.amount,
  //     ledgerDate: m.ledger.date,
  //     ledgerNarration: m.ledger.narration,
  //     ledgerAmount: m.ledger.amount,
  //     status: "MATCHED",
  //   });
  // });

  results.unmatchedBank.forEach((b) => {
    sheet.addRow({
      bankDate: b.date,
      bankNarration: b.narration,
      bankAmount: b.amount,
      status: "ONLY IN BANK",
    });
  });

  // results.unmatchedLedger.forEach((l) => {
  //   sheet.addRow({
  //     ledgerDate: l.date,
  //     ledgerNarration: l.narration,
  //     ledgerAmount: l.amount,
  //     status: "ONLY IN LEDGER",
  //   });
  // });

  await workbook.xlsx.writeFile(filePath);
};
