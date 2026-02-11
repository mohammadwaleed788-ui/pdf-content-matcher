import { createRequire } from "module";
const require = createRequire(import.meta.url);

try {
    const pdf = require("pdf-parse");
    console.log("Type of pdf:", typeof pdf);
    console.log("pdf value:", pdf);
    if (typeof pdf === 'function') {
        console.log("pdf is a function");
    } else {
        console.log("pdf is NOT a function");
        if (pdf.default) {
            console.log("pdf.default is:", typeof pdf.default);
        }
    }
} catch (e) {
    console.log("Error requiring pdf-parse:", e);
}
