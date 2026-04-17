import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { parseFile } from "../utils/parseFile.js";
import { matchTransactions } from "../utils/matchTransactions.js";
import { generateExcel } from "../utils/generateExcel.js";

const router = express.Router();

const UPLOAD_DIR = "uploads";
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (_req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});

const fileFilter = (_req, file, cb) => {
  const allowed = [".pdf", ".xlsx", ".xlsm", ".xls"];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) cb(null, true);
  else cb(new Error(`Unsupported file type: ${ext}`));
};

const upload = multer({ storage, fileFilter });

router.post(
  "/reconcile",
  upload.fields([
    { name: "bankFile", maxCount: 1 },
    { name: "ledgerFile", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const bankInfo = req.files.bankFile?.[0];
      const ledgerInfo = req.files.ledgerFile?.[0];

      if (!bankInfo || !ledgerInfo) {
        return res
          .status(400)
          .json({ error: "Both bank and ledger files are required" });
      }

      console.log("\n========== BANK PARSING ==========");
      console.log(`File: ${bankInfo.originalname}`);
      const bankTxns = await parseFile(bankInfo.path, bankInfo.originalname);
      console.log(`Bank transaction count: ${bankTxns.length}`);
      console.log("\nSample bank transactions:");
      bankTxns.slice(0, 5).forEach((t, i) => {
        console.log(
          `${i + 1}. ${t.date} | ${t.narration.substring(0, 40)}... | D:${t.debit} C:${t.credit}`
        );
      });

      console.log("\n========== LEDGER PARSING ==========");
      console.log(`File: ${ledgerInfo.originalname}`);
      const ledgerTxns = await parseFile(
        ledgerInfo.path,
        ledgerInfo.originalname
      );
      console.log(`Ledger transaction count: ${ledgerTxns.length}`);
      console.log("\nSample ledger transactions:");
      ledgerTxns.slice(0, 5).forEach((t, i) => {
        console.log(
          `${i + 1}. ${t.date} | ${t.narration.substring(0, 40)}... | D:${t.debit} C:${t.credit}`
        );
      });

      console.log("\n========== MATCHING ==========");
      const results = matchTransactions(bankTxns, ledgerTxns);

      console.log("\n========== RESULTS ==========");
      console.log(`Matched: ${results.matches.length}`);
      console.log(`Only in Bank: ${results.unmatchedBank.length}`);
      console.log(`Only in Ledger: ${results.unmatchedLedger.length}`);

      console.log("\nSample matches:");
      results.matches.slice(0, 5).forEach((m, i) => {
        console.log(`${i + 1}. ${m.status} [${m.confidence}]`);
        console.log(
          `   Bank: ${m.bank.date} | ${m.bank.narration.substring(0, 40)}...`
        );
        console.log(
          `   Ledger: ${m.ledger.date} | ${m.ledger.narration.substring(0, 40)}...`
        );
      });

      const outputPath = path.join(
        UPLOAD_DIR,
        `reconciliation-${Date.now()}.xlsx`
      );
      await generateExcel(results, outputPath);

      const filesToClean = [
        bankInfo.path,
        ledgerInfo.path,
        outputPath,
      ];

      res.download(path.resolve(outputPath), "reconciliation.xlsx", () => {
        for (const f of filesToClean) {
          fs.unlink(f, () => {});
        }
      });
    } catch (err) {
      console.error("❌ Reconciliation error:", err);
      const filesToClean = [
        req.files?.bankFile?.[0]?.path,
        req.files?.ledgerFile?.[0]?.path,
      ].filter(Boolean);
      for (const f of filesToClean) {
        fs.unlink(f, () => {});
      }
      res.status(500).json({ error: err.message });
    }
  }
);

export default router;
