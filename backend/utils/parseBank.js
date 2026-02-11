import fs from "fs";
import { PDFParse } from "pdf-parse";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat.js";

dayjs.extend(customParseFormat);

export const parseBankPDF = async (filePath) => {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await new PDFParse({ data: dataBuffer }).getText();

    const lines = data.text.split("\n").map((l) => l.trim());
    const transactions = [];

    // 1. Date at the very beginning of the line (DD-MMM-YYYY)
    const dateRegex = /^(\d{2}-[A-Za-z]{3}-\d{4})/;

    // 2. Two decimal numbers at the very end (amount + balance)
    const amountBalanceRegex = /(\d+\.\d+)\s*(\d+\.\d+)$/;

    for (let line of lines) {
        if (!line) continue;

        const dateMatch = line.match(dateRegex);
        if (!dateMatch) continue;

        const amountMatch = line.match(amountBalanceRegex);
        if (!amountMatch) continue;

        const dateStr = dateMatch[1];
        const amount = parseFloat(amountMatch[1]);

        // Narration = everything between the date(s) and the amount
        let narration = line.substring(dateMatch[0].length, line.lastIndexOf(amountMatch[1])).trim();

        // Some lines have a second date inside the narration – remove it
        const secondDateMatch = narration.match(/^\d{2}-[A-Za-z]{3}-\d{4}/);
        if (secondDateMatch) {
            narration = narration.substring(secondDateMatch[0].length).trim();
        }

        transactions.push({
            date: dayjs(dateStr, "DD-MMM-YYYY").format("YYYY-MM-DD"),
            amount,
            narration,
        });
    }

    console.log(`✅ Bank parser extracted ${transactions.length} transactions`);
    return transactions;
};