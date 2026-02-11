import { createRequire } from "module";
const require = createRequire(import.meta.url);

try {
    const pdf = require("pdf-parse");
    console.log("Type:", typeof pdf);
    if (typeof pdf === 'object') {
        console.log("Keys:", Object.keys(pdf));
        if (pdf.default) console.log("Has default export");
    }
} catch (e) {
    console.log("Error:", e);
}
