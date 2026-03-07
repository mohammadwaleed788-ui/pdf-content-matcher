import ExcelJS from "exceljs";

export const generateExcel = async (results, filePath) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Reconciliation");

  sheet.columns = [
    { header: "Date", key: "bankDate", width: 15 },
    { header: "Narration", key: "bankNarration", width: 30 },
    { header: "Debit", key: "bankDebit", width: 15 },
    { header: "Credit", key: "bankCredit", width: 15 },
    // { header: "Ledger Date", key: "ledgerDate", width: 15 },
    // { header: "Ledger Narration", key: "ledgerNarration", width: 30 },
    // { header: "Ledger Debit", key: "ledgerDebit", width: 15 },
    // { header: "Ledger Credit", key: "ledgerCredit", width: 15 },
    { header: "Status", key: "status", width: 15 },
  ];

  // results.matches.forEach((m) => {
  //   sheet.addRow({
  //     bankDate: m.bank.date,
  //     bankNarration: m.bank.narration,
  //     bankDebit: m.bank.debit || "",
  //     bankCredit: m.bank.credit || "",
  //     ledgerDate: m.ledger.date,
  //     ledgerNarration: m.ledger.narration,
  //     ledgerDebit: m.ledger.debit || "",
  //     ledgerCredit: m.ledger.credit || "",
  //     status: "MATCHED",
  //   });
  // });

  results.unmatchedBank.forEach((b) => {
    sheet.addRow({
      bankDate: b.date,
      bankNarration: b.narration,
      bankDebit: b.debit || "",
      bankCredit: b.credit || "",
      status: "ONLY IN BANK",
    });
  });

  // results.unmatchedLedger.forEach((l) => {
  //   sheet.addRow({
  //     ledgerDate: l.date,
  //     ledgerNarration: l.narration,
  //     ledgerDebit: l.debit || "",
  //     ledgerCredit: l.credit || "",
  //     status: "ONLY IN LEDGER",
  //   });
  // });

  await workbook.xlsx.writeFile(filePath);
};
