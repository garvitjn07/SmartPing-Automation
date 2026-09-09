const fs = require("fs");
const path = require("path");
const xlsx = require("xlsx");

const chunkPlan = require("../chunkPlan");

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
 * Collects the AI verdict (PASS / WARN / FAIL) of every template review.
 *
 * A chunked run has five processes collecting rows at once, so each one drops
 * its rows into a small JSON partial inside its own output folder rather than
 * writing a spreadsheet. `scripts/merge-reports.js` reads the partials back in
 * chunk order and writes the one spreadsheet for the whole run.
 */
class VerdictSummary {
  static rows = [];

  /** Which slice of the worksheet this process is running; set by the suite. */
  static chunk = null;

  /**
   * Records the chunk this process owns so the partial can be ordered against
   * the other chunks at merge time.
   * @param {{index: number, name: string, startIndex: number, endIndex: number}} chunk
   */
  static describeChunk(chunk) {
    VerdictSummary.chunk = chunk;
  }

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
   * Writes the rows collected by this process to a JSON partial in its output
   * folder, tagged with the row range so the merge step can order it.
   * @param {string} fileName - Partial file name.
   * @returns {string|null} Path of the written file, or null when nothing ran.
   */
  static write(fileName = chunkPlan.PARTIAL_SUMMARY_FILE) {
    if (VerdictSummary.rows.length === 0) return null;

    const outputDir =
      global.output_dir || path.join(process.cwd(), chunkPlan.BASE_OUTPUT_DIR);
    fs.mkdirSync(outputDir, { recursive: true });

    const partialFile = path.join(outputDir, fileName);
    fs.writeFileSync(
      partialFile,
      JSON.stringify(
        {
          chunk: VerdictSummary.chunk,
          // Falls back to 0 so an unchunked run still merges cleanly.
          startIndex: VerdictSummary.chunk ? VerdictSummary.chunk.startIndex : 0,
          rows: VerdictSummary.rows,
        },
        null,
        2,
      ),
    );

    return partialFile;
  }

  /**
   * Writes summary rows out as the run's spreadsheet.
   * @param {object[]} rows - Rows in the order they should appear.
   * @param {string} filePath - Destination .xlsx path.
   * @returns {string|null} The path written, or null when there are no rows.
   */
  static writeWorkbook(rows, filePath) {
    if (!rows || rows.length === 0) return null;

    fs.mkdirSync(path.dirname(filePath), { recursive: true });

    const worksheet = xlsx.utils.json_to_sheet(rows, { header: COLUMNS });
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, SHEET_NAME);
    xlsx.writeFile(workbook, filePath);

    return filePath;
  }
}

module.exports = VerdictSummary;
module.exports.COLUMNS = COLUMNS;
module.exports.SHEET_NAME = SHEET_NAME;
