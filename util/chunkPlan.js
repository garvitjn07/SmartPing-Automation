const path = require("path");

// Every artefact of a run lands under this folder: one sub-folder per chunk
// while the run is in flight, then the merged report/summary at its root.
const BASE_OUTPUT_DIR = "output-smartping";

// Number of processes the suite is split across. 75 rows over 4 chunks is 19
// each for the first three and 18 for the last.
const DEFAULT_CHUNK_COUNT = 4;

/** Name of the merged report and summary files written at the end of a run. */
const MERGED_REPORT_NAME = "smartping-report";
const MERGED_SUMMARY_FILE = "smartping-verdict-summary.xlsx";

// Per-chunk file holding that process' summary rows. The merge step reads
// these back and turns them into the single spreadsheet.
const PARTIAL_SUMMARY_FILE = "verdict-summary.part.json";

function parseCount(value, fallback) {
  if (value === undefined || value === "") return fallback;

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`Invalid CHUNK_COUNT="${value}". Expected a positive integer.`);
  }

  return parsed;
}

/** How many chunks this run is split into (CHUNK_COUNT, default 4). */
function chunkCount() {
  return parseCount(process.env.CHUNK_COUNT, DEFAULT_CHUNK_COUNT);
}

/**
 * Smoke-test cap on the number of worksheet rows the run uses (ROW_LIMIT).
 * Applied before the rows are chunked, so ROW_LIMIT=5 means five test cases in
 * total, not five per chunk.
 * @returns {number|null} The cap, or null when the whole workbook runs.
 */
function rowLimit() {
  const raw = process.env.ROW_LIMIT;
  if (raw === undefined || raw === "") return null;

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`Invalid ROW_LIMIT="${raw}". Expected a positive integer.`);
  }

  return parsed;
}

/**
 * Cap on how many rows each chunk runs from its own range (ROWS_PER_CHUNK).
 * Unlike ROW_LIMIT this keeps the real four-way split intact and just takes
 * the first N rows of each slice, so ROWS_PER_CHUNK=1 runs the first row of
 * every chunk - TC_01, TC_20, TC_39, TC_58 - rather than TC_01 to TC_04.
 * @returns {number|null} The per-chunk cap, or null when the chunk runs in full.
 */
function rowsPerChunk() {
  const raw = process.env.ROWS_PER_CHUNK;
  if (raw === undefined || raw === "") return null;

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(
      `Invalid ROWS_PER_CHUNK="${raw}". Expected a positive integer.`,
    );
  }

  return parsed;
}

/** Zero-based index of the chunk this process owns (CHUNK, default 0). */
function chunkIndex() {
  const raw = process.env.CHUNK === undefined || process.env.CHUNK === "" ? "0" : process.env.CHUNK;
  const parsed = Number.parseInt(raw, 10);
  const count = chunkCount();

  if (!Number.isInteger(parsed) || parsed < 0 || parsed >= count) {
    throw new Error(
      `Invalid CHUNK="${raw}". Expected an integer between 0 and ${count - 1}.`,
    );
  }

  return parsed;
}

/** Folder name of a chunk, e.g. chunk-1 for index 0. */
function chunkName(index) {
  return `chunk-${index + 1}`;
}

/** Output folder a chunk writes its report, screenshots and partial into. */
function chunkOutputDir(index) {
  return path.join(BASE_OUTPUT_DIR, chunkName(index));
}

/** Mochawesome report file name of a chunk, without extension. */
function chunkReportName(index) {
  return `smartping-${chunkName(index)}`;
}

/**
 * Slice of the worksheet a chunk is responsible for. Chunks are contiguous, so
 * chunk 1 runs rows 1-19 in order, chunk 2 rows 20-38, and so on; the last
 * chunk takes whatever remains when the row count is not divisible.
 * @param {number} index - Zero-based chunk index.
 * @param {number} totalRows - Number of data rows in the worksheet.
 * @param {number} [count] - Total number of chunks.
 * @returns {{startIndex: number, endIndex: number, size: number}} Zero-based,
 *   end-exclusive row range.
 */
function rangeFor(index, totalRows, count = chunkCount()) {
  const size = Math.ceil(totalRows / count);
  const startIndex = Math.min(index * size, totalRows);
  const endIndex = Math.min(startIndex + size, totalRows);

  return { startIndex, endIndex, size };
}

module.exports = {
  BASE_OUTPUT_DIR,
  DEFAULT_CHUNK_COUNT,
  MERGED_REPORT_NAME,
  MERGED_SUMMARY_FILE,
  PARTIAL_SUMMARY_FILE,
  chunkCount,
  chunkIndex,
  rowLimit,
  rowsPerChunk,
  chunkName,
  chunkOutputDir,
  chunkReportName,
  rangeFor,
};
