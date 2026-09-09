const { I, smartpingPage } = inject();

const CommonUtils = require("../util/CommonUtils");
const VerdictSummary = require("../util/helpers/VerdictSummary");
const chunkPlan = require("../util/chunkPlan");
const preReqConfig = require("../config/prerequisiteConfig.json");

const worksheetRows = CommonUtils.loadXlsRowsBySheetName(
  preReqConfig.dataFiles.preRequisiteFile,
  preReqConfig.dataFiles.sheetName,
);

// ROW_LIMIT trims the workbook before it is chunked, for smoke runs against a
// handful of rows: ROW_LIMIT=5 is five test cases for the whole run, not five
// per chunk. Unset means all 75 rows.
const rowLimit = chunkPlan.rowLimit();
const smartpingRows = rowLimit
  ? worksheetRows.slice(0, rowLimit)
  : worksheetRows;

// This process owns one contiguous slice of the worksheet - 75 rows split
// five ways gives chunk 1 rows 1-15, chunk 2 rows 16-30, and so on. Within a
// chunk the rows still run one after another in sheet order, against a single
// browser session; only the five chunks run at the same time.
const chunkIndex = chunkPlan.chunkIndex();
const chunkLabel = `chunk ${chunkIndex + 1}/${chunkPlan.chunkCount()}`;
const { startIndex, endIndex } = chunkPlan.rangeFor(
  chunkIndex,
  smartpingRows.length,
);
const chunkRows = smartpingRows.slice(startIndex, endIndex);

// A low ROW_LIMIT can leave the higher chunks with nothing to do - five chunks
// over three rows fills the first three only. Such a chunk registers no
// scenarios and exits cleanly rather than failing the run.
if (chunkRows.length === 0) {
  console.log(
    `[${chunkLabel}] no rows in this chunk (${smartpingRows.length} row(s) available) - nothing to run.`,
  );
}

VerdictSummary.describeChunk({
  index: chunkIndex,
  name: chunkPlan.chunkName(chunkIndex),
  startIndex,
  endIndex,
});

// The row range is part of the feature name so the merged report reads as one
// continuous 1-75 sequence instead of five identically titled suites.
Feature(
  chunkRows.length
    ? `Smartping AI Review Test Suite - rows ${startIndex + 1}-${endIndex}`
    : `Smartping AI Review Test Suite - ${chunkPlan.chunkName(chunkIndex)} (no rows)`,
);

BeforeSuite(async () => {
  // Authenticate once and reuse the browser session for every row in the chunk.
  console.log(
    `[${chunkLabel}] rows ${startIndex + 1}-${endIndex} (${chunkRows.length} test cases)` +
      (rowLimit ? ` [ROW_LIMIT=${rowLimit} of ${worksheetRows.length}]` : ""),
  );
  await smartpingPage.login();
});

After(async () => {
  // Runs after every scenario, passed or failed, in its own step session. A row
  // that fails mid-review must not leave the app on the Compliance page, or
  // every row after it would fail looking for the registration inputs.
  await smartpingPage.resetTemplateForm();
});

AfterSuite(async () => {
  // Hand this chunk's PASS / WARN / FAIL rows to the merge step, which folds
  // all five chunks into the single summary spreadsheet.
  const partialFile = VerdictSummary.write();
  if (!partialFile) return;

  const totals = VerdictSummary.verdictTotals();
  const breakdown = Object.entries(totals)
    .map(([verdict, count]) => `${verdict}: ${count}`)
    .join(" | ");

  console.log(`\n[${chunkLabel}] Verdict summary (${breakdown})`);
  console.log(`[${chunkLabel}] Saved to ${partialFile}\n`);
});

// Define one Codecept scenario per worksheet row so Mochawesome records each
// template review as a separate test case.
chunkRows.forEach((current, positionInChunk) => {
  const rowIndex = startIndex + positionInChunk;
  const testCaseId =
    current.TCID || current.testCaseId || `smartping-row-${rowIndex + 2}`;

  Scenario(`DLT template review: ${testCaseId}`, async () => {
    // Progress marker: the mochawesome reporter replaces Codecept's own step
    // output, so this is what makes a long chunk readable while it runs.
    console.log(
      `[${chunkLabel}] ${positionInChunk + 1}/${chunkRows.length} - ${testCaseId} (row ${rowIndex + 1})`,
    );

    // Registered up front so a row still appears in the summary if it fails.
    const summaryRow = VerdictSummary.record({
      TCID: testCaseId,
      "Entity Name": current["Entity Name"],
      "Header/CLI associated": current["Header/CLI associated"],
    });

    try {
      // Map the workbook columns to the fields required by Smartping.
      await smartpingPage.fillTemplateData({
        entityName: current["Entity Name"],
        header: current["Header/CLI associated"],
        message: current.Content,

        // Variable inputs are intentionally disabled until the next test phase.
        //   variable1: current["Variable 1"] || current.variable1,
        //   variable2: current["Variable 2"] || current.variable2,
        //   variable3: current["Variable 3"] || current.variable3,
        //   variable4: current["Variable 4"] || current.variable4,
      });

      // Captures the Overview tab, waits, then captures the Findings tab.
      const review = await smartpingPage.runAiReview(testCaseId);
      summaryRow.Verdict = review.verdict;
      summaryRow["Compliance Score"] = review.complianceScore;
      summaryRow["Execution Status"] = "passed";
    } catch (error) {
      summaryRow["Execution Status"] = "failed";
      summaryRow.Notes = error.message;
      throw error;
    }
  });
});
