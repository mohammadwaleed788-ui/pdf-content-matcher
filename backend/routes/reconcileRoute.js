// routes/reconcileRoute.js
import express from "express";
import multer from "multer";
import path from "path";
import { parseBankPDF } from "../utils/parseBank.js";
import { parseLedgerPDF } from "../utils/parseLedger.js";
import { matchTransactions } from "../utils/matchTransactions.js";
import { generateExcel } from "../utils/generateExcel.js";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

router.post(
  "/reconcile",
  upload.fields([
    { name: "bankPdf", maxCount: 1 },
    { name: "ledgerPdf", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const bankPath = req.files.bankPdf[0].path;
      const ledgerPath = req.files.ledgerPdf[0].path;

      console.log("\n========== BANK PARSING ==========");
      const bankTxns = await parseBankPDF(bankPath);
      console.log(`Bank transaction count: ${bankTxns.length}`);
      console.log("\nSample bank transactions:");
      bankTxns.slice(0, 5).forEach((t, i) => {
        console.log(`${i + 1}. ${t.date} | ${t.narration.substring(0, 30)}... | D:${t.debit} C:${t.credit}`);
      });

      console.log("\n========== LEDGER PARSING ==========");
      const ledgerTxns = await parseLedgerPDF(ledgerPath);
      console.log(`Ledger transaction count: ${ledgerTxns.length}`);
      console.log("\nSample ledger transactions:");
      ledgerTxns.slice(0, 5).forEach((t, i) => {
        console.log(`${i + 1}. ${t.date} | ${t.narration.substring(0, 30)}... | D:${t.debit} C:${t.credit}`);
      });

      console.log("\n========== MATCHING ==========");
      const results = matchTransactions(bankTxns, ledgerTxns);

      console.log("\n========== RESULTS ==========");
      console.log(`Matched: ${results.matches.length}`);
      console.log(`Only in Bank: ${results.unmatchedBank.length}`);
      console.log(`Only in Ledger: ${results.unmatchedLedger.length}`);

      // Show some matches
      console.log("\nSample matches:");
      results.matches.slice(0, 5).forEach((m, i) => {
        console.log(`${i + 1}. ${m.status}`);
        console.log(`   Bank: ${m.bank.date} | ${m.bank.narration.substring(0, 40)}...`);
        console.log(`   Ledger: ${m.ledger.date} | ${m.ledger.narration.substring(0, 40)}...`);
      });

      const outputPath = "uploads/reconciliation.xlsx";
      await generateExcel(results, outputPath);

      res.download(path.resolve(outputPath));
    } catch (err) {
      console.error("❌ Reconciliation error:", err);
      res.status(500).json({ error: err.message });
    }
  }
);

export default router;