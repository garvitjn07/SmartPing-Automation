#!/usr/bin/env node
/**
 * Folds the per-chunk output of a parallel run into one report per artefact:
 *
 *   output-smartping/smartping-report.json          merged Mochawesome data
 *   output-smartping/smartping-report.html          merged Mochawesome report
 *   output-smartping/smartping-verdict-summary.xlsx merged verdict summary
 *
 * Chunks are read in order, so the merged report and the spreadsheet both run
 * TC_01 through TC_75 top to bottom even though the chunks ran concurrently.
 */
const fs = require("fs");
const path = require("path");

const { merge } = require("mochawesome-merge");
const marge = require("mochawesome-report-generator");

const chunkPlan = require("../util/chunkPlan");
const VerdictSummary = require("../util/helpers/VerdictSummary");

const projectRoot = path.join(__dirname, "..");
const baseOutputDir = path.join(projectRoot, chunkPlan.BASE_OUTPUT_DIR);

/** Chunk folders that actually produced output, lowest chunk first. */
function completedChunks() {
  const chunks = [];

  for (let index = 0; index < chunkPlan.chunkCount(); index += 1) {
    const dir = path.join(projectRoot, chunkPlan.chunkOutputDir(index));
    const reportFile = path.join(
      dir,
      `${chunkPlan.chunkReportName(index)}.json`,
    );
    const partialFile = path.join(dir, chunkPlan.PARTIAL_SUMMARY_FILE);

    chunks.push({
      index,
      name: chunkPlan.chunkName(index),
      reportFile: fs.existsSync(reportFile) ? reportFile : null,
      partialFile: fs.existsSync(partialFile) ? partialFile : null,
    });
  }

  return chunks;
}

/** Merged Mochawesome JSON + HTML for every chunk that reported. */
async function mergeReports(chunks) {
  const reportFiles = chunks.map((chunk) => chunk.reportFile).filter(Boolean);

  if (reportFiles.length === 0) {
    console.warn("No chunk reports found - skipping the merged report.");
    return null;
  }

  // Explicit file list rather than a glob: it keeps chunk-1..chunk-5 in order
  // and never picks up the verdict partials sitting in the same folders.
  const merged = await merge({ files: reportFiles });

  const jsonFile = path.join(
    baseOutputDir,
    `${chunkPlan.MERGED_REPORT_NAME}.json`,
  );
  fs.mkdirSync(baseOutputDir, { recursive: true });
  fs.writeFileSync(jsonFile, JSON.stringify(merged, null, 2));

  const [htmlFile] = await marge.create(merged, {
    reportDir: baseOutputDir,
    reportFilename: chunkPlan.MERGED_REPORT_NAME,
    reportTitle: "Smartping AI Review",
    reportPageTitle: "Smartping AI Review Report",
    inline: true,
    charts: true,
    code: false,
    overwrite: true,
    saveJson: false,
  });

  return { jsonFile, htmlFile, merged, reportFiles };
}

/** One spreadsheet holding every chunk's rows, in worksheet order. */
function mergeSummaries(chunks) {
  const partials = chunks
    .filter((chunk) => chunk.partialFile)
    .map((chunk) => ({
      chunk,
      data: JSON.parse(fs.readFileSync(chunk.partialFile, "utf8")),
    }))
    .sort((a, b) => (a.data.startIndex ?? 0) - (b.data.startIndex ?? 0));

  if (partials.length === 0) {
    console.warn("No verdict partials found - skipping the summary spreadsheet.");
    return null;
  }

  const rows = partials.flatMap((partial) => partial.data.rows || []);
  const summaryFile = VerdictSummary.writeWorkbook(
    rows,
    path.join(baseOutputDir, chunkPlan.MERGED_SUMMARY_FILE),
  );

  return { summaryFile, rows };
}

function verdictBreakdown(rows) {
  const totals = rows.reduce((counts, row) => {
    const verdict = row.Verdict || "N/A";
    counts[verdict] = (counts[verdict] || 0) + 1;
    return counts;
  }, {});

  return Object.entries(totals)
    .map(([verdict, count]) => `${verdict}: ${count}`)
    .join(" | ");
}

async function main() {
  const chunks = completedChunks();

  const missing = chunks.filter((chunk) => !chunk.reportFile);
  if (missing.length) {
    console.warn(
      `Missing report for: ${missing.map((chunk) => chunk.name).join(", ")} - merging the rest.`,
    );
  }

  const report = await mergeReports(chunks);
  const summary = mergeSummaries(chunks);

  console.log("\n================ Smartping run summary ================");

  if (report) {
    const { stats } = report.merged;
    console.log(
      `Tests: ${stats.tests} | passed: ${stats.passes} | failed: ${stats.failures} | pending: ${stats.pending}`,
    );
    console.log(`Merged from ${report.reportFiles.length} chunk report(s)`);
    console.log(`Report JSON: ${path.relative(projectRoot, report.jsonFile)}`);
    console.log(`Report HTML: ${path.relative(projectRoot, report.htmlFile)}`);
  }

  if (summary) {
    console.log(`Verdicts   : ${verdictBreakdown(summary.rows)}`);
    console.log(
      `Summary XLS: ${path.relative(projectRoot, summary.summaryFile)} (${summary.rows.length} rows)`,
    );
  }

  console.log("=======================================================\n");

  if (!report && !summary) {
    throw new Error("Nothing to merge - did the chunks run?");
  }
}

main().catch((error) => {
  console.error(`Merge failed: ${error.message}`);
  process.exitCode = 1;
});
