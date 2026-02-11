import express from "express";
import multer from "multer";
import path from "path";

import { parseBankPDF } from "../utils/parseBank.js";
import { parseLedgerPDF } from "../utils/parseledger.js";
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

      const bankTxns = await parseBankPDF(bankPath);
      console.log("Bank transaction count:", bankTxns.length);
      console.log("Sample of first 5:", bankTxns.slice(0, 5));
      console.log("Sample of last 5:", bankTxns.slice(-5));

      const ledgerTxns = await parseLedgerPDF(ledgerPath);

      console.log("Ledger transaction count:", ledgerTxns.length);
      console.log("Unique dates:", [...new Set(ledgerTxns.map(t => t.date))].sort());

      const results = matchTransactions(bankTxns, ledgerTxns);

      const outputPath = "uploads/reconciliation.xlsx";

      await generateExcel(results, outputPath);

      res.download(path.resolve(outputPath));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

export default router;
