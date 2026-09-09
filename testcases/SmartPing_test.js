const { I, smartpingPage } = inject();

const CommonUtils = require("../util/CommonUtils");
const VerdictSummary = require("../util/helpers/VerdictSummary");
const preReqConfig = require("../config/prerequisiteConfig.json");

Feature("Smartping AI Review Test Suite");

const smartpingRows = CommonUtils.loadXlsRowsBySheetName(
  preReqConfig.dataFiles.preRequisiteFile,
  preReqConfig.dataFiles.sheetName,
);

BeforeSuite(async () => {
  // Authenticate once and reuse the browser session for every XLS row.
  await smartpingPage.login();
});

After(async () => {
  // Runs after every scenario, passed or failed, in its own step session. A row
  // that fails mid-review must not leave the app on the Compliance page, or
  // every row after it would fail looking for the registration inputs.
  await smartpingPage.resetTemplateForm();
});

AfterSuite(async () => {
  // Write the PASS / WARN / FAIL summary once every row has been reviewed.
  const summaryFile = VerdictSummary.write();
  if (!summaryFile) return;

  const totals = VerdictSummary.verdictTotals();
  const breakdown = Object.entries(totals)
    .map(([verdict, count]) => `${verdict}: ${count}`)
    .join(" | ");

  console.log(`\nVerdict summary (${breakdown})`);
  console.log(`Saved to ${summaryFile}\n`);
});

// Define one Codecept scenario per worksheet row so Mochawesome records each
// template review as a separate test case.
// Temporary run limit: exercise the first five worksheet rows only. (.slice(0, 3).)
smartpingRows.slice(0, 3).forEach((current, rowIndex) => {
  const testCaseId =
    current.TCID || current.testCaseId || `smartping-row-${rowIndex + 2}`;

  Scenario(`DLT template review: ${testCaseId}`, async () => {
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
