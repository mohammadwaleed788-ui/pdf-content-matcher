import pdf from "pdf-parse";

try {
    console.log("Type of pdf (ESM):", typeof pdf);
    console.log("pdf value (ESM):", pdf);
    if (typeof pdf === 'function') {
        console.log("pdf is a function (ESM)");
    } else {
        console.log("pdf is NOT a function (ESM)");
        if (pdf && pdf.default) {
            console.log("pdf.default is:", typeof pdf.default);
        }
    }
} catch (e) {
    console.log("Error:", e);
}
