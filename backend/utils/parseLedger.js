import fs from "fs";
import { PDFParse } from "pdf-parse";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat.js";

dayjs.extend(customParseFormat);

export const parseLedgerPDF = async (filePath) => {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await new PDFParse({ data: dataBuffer }).getText();

    const fullText = data.text;
    const transactions = [];

    // 1. Find every occurrence of "cd" followed by an amount
    const cdRegex = /cd\s+([\d,]+\.\d+)/gi;
    let match;
    while ((match = cdRegex.exec(fullText)) !== null) {
        const amountStr = match[1].replace(/,/g, "");
        const amount = parseFloat(amountStr);
        const cdPosition = match.index;

        // 2. Search backwards from cdPosition to find the nearest date
        const textBeforeCd = fullText.substring(0, cdPosition);
        const dateRegex = /\b(\d{1,2}-\d{1,2}-\d{4})\b[^]*$/; // last date before cd
        const dateMatch = textBeforeCd.match(dateRegex);
        if (!dateMatch) continue;

        const dateStr = dateMatch[1];
        const datePosition = dateMatch.index;

        // 3. Narration = everything from the date up to the "cd"
        let narration = fullText.substring(datePosition, cdPosition).trim();

        // Clean up: remove any trailing "Journal" or "Vch Type" debris
        narration = narration.replace(/\s+Journal$/, "").trim();

        transactions.push({
            date: dayjs(dateStr, "D-M-YYYY").format("YYYY-MM-DD"),
            amount,
            narration,
        });
    }

    console.log(`✅ Ledger parser extracted ${transactions.length} transactions`);
    return transactions;
};