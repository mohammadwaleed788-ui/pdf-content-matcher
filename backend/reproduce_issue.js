import fs from "fs";
import path from "path";
import { parseBankPDF } from "./utils/parseBank.js";
import { parseLedgerPDF } from "./utils/parseledger.js";

const uploadsDir = path.join(process.cwd(), "uploads");

const run = async () => {
    console.log("Checking uploads directory:", uploadsDir);
    if (!fs.existsSync(uploadsDir)) {
        console.log("Uploads directory not found.");
        return;
    }

    const files = fs.readdirSync(uploadsDir);
    console.log(`Found ${files.length} files.`);

    for (const file of files) {
        if (file.endsWith(".xlsx")) continue; // Skip output files
        const filePath = path.join(uploadsDir, file);
        console.log(`\nTesting file: ${file}`);
        const stat = fs.statSync(filePath);
        console.log(`Size: ${stat.size} bytes`);
        if (stat.size < 1000) {
            console.log("Skipping small file (likely not a valid PDF or empty).");
            continue;
        }

        // Try Bank Parse
        try {
            console.log("  Attempting parseBankPDF...");
            const bankResult = await parseBankPDF(filePath);
            console.log(`  [SUCCESS] parseBankPDF found ${bankResult.length} transactions.`);
            // console.log("  Sample:", bankResult.slice(0, 1));
        } catch (err) {
            console.log(`  [FAILED] parseBankPDF: ${err.message}`);
        }

        // Try Ledger Parse
        try {
            console.log("  Attempting parseLedgerPDF...");
            const ledgerResult = await parseLedgerPDF(filePath);
            console.log(`  [SUCCESS] parseLedgerPDF found ${ledgerResult.length} transactions.`);
            // console.log("  Sample:", ledgerResult.slice(0, 1));
        } catch (err) {
            console.log(`  [FAILED] parseLedgerPDF: ${err.message}`);
        }
    }
};

run().catch(console.error);
