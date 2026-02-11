import fs from "fs";
import path from "path";
import { PDFParse } from "pdf-parse";

const uploadsDir = path.join(process.cwd(), "uploads");
const files = fs.readdirSync(uploadsDir).filter(f => !f.endsWith(".xlsx"));
if (files.length === 0) {
    console.log("No files to test.");
    process.exit(0);
}
const filePath = path.join(uploadsDir, files[0]);
console.log("Testing with:", filePath);

const buffer = fs.readFileSync(filePath);

(async () => {
    try {
        const parser = new PDFParse({ data: buffer });
        const result = await parser.getText();
        console.log("Text length:", result.text.length);
        console.log("First 100 chars:", result.text.substring(0, 100));
    } catch (e) {
        console.log("Error:", e);
    }
})();
