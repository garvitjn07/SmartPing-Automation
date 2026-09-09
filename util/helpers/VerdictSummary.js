const fs = require("fs");
const path = require("path");
const xlsx = require("xlsx");

// Column order of the generated summary sheet.
const COLUMNS = [
  "TCID",
  "Entity Name",
  "Header/CLI associated",
  "Verdict",
  "Compliance Score",
  "Execution Status",
  "Notes",
];

const SHEET_NAME = "Verdict Summary";

/**
 * Collects the AI verdict (PASS / WARN / FAIL) of every template review and
 * writes them out as a single spreadsheet next to the Mochawesome report.
 */
class VerdictSummary {
  static rows = [];

  /**
   * Adds a row to the summary and returns it so the caller can update the
   * verdict and execution status once the scenario finishes.
   * @param {object} row - Partial row; missing columns default to empty.
   * @returns {object} The stored row reference.
   */
  static record(row) {
    const entry = {
      TCID: "",
      "Entity Name": "",
      "Header/CLI associated": "",
      Verdict: "N/A",
      "Compliance Score": "N/A",
      "Execution Status": "not run",
      Notes: "",
      ...row,
    };

    VerdictSummary.rows.push(entry);
    return entry;
  }

  /** Counts of each verdict value across the recorded rows. */
  static verdictTotals() {
    return VerdictSummary.rows.reduce((totals, row) => {
      const verdict = row.Verdict || "N/A";
      totals[verdict] = (totals[verdict] || 0) + 1;
      return totals;
    }, {});
  }

  /**
   * Writes the collected rows to an XLSX file inside the output folder.
   * @param {string} fileName - Summary file name.
   * @returns {string|null} Path of the written file, or null when nothing ran.
   */
  static write(fileName = "smartping-verdict-summary.xlsx") {
    if (VerdictSummary.rows.length === 0) return null;

    const outputDir =
      global.output_dir || path.join(process.cwd(), "output-smartping");
    fs.mkdirSync(outputDir, { recursive: true });

    const worksheet = xlsx.utils.json_to_sheet(VerdictSummary.rows, {
      header: COLUMNS,
    });
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, SHEET_NAME);

    const summaryFile = path.join(outputDir, fileName);
    xlsx.writeFile(workbook, summaryFile);

    return summaryFile;
  }
}

module.exports = VerdictSummary;
module.exports.COLUMNS = COLUMNS;
