import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat.js";

try {
    console.log("dayjs loaded:", typeof dayjs);
    console.log("customParseFormat loaded:", typeof customParseFormat);
    dayjs.extend(customParseFormat);
    console.log("Plugin extended");
    const d = dayjs("01-Jan-2023", "DD-MMM-YYYY");
    console.log("Date parsed:", d.format("YYYY-MM-DD"));
} catch (e) {
    console.log("Error:", e);
}
