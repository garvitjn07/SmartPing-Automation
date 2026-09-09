const { I, smartpingPage } = inject();

const CommonUtils = require("../util/CommonUtils");
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

// Define one Codecept scenario per worksheet row so Mochawesome records each
// template review as a separate test case.
// Temporary run limit: exercise the first five worksheet rows only. (.slice(0, 3).)
smartpingRows.forEach((current, rowIndex) => {
  const testCaseId =
    current.TCID || current.testCaseId || `smartping-row-${rowIndex + 2}`;

  Scenario(`DLT template review: ${testCaseId}`, async () => {
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
    await smartpingPage.runAiReview(testCaseId);

    // Return to the registration form before processing the next row.
    await smartpingPage.resetTemplateForm();
  });
});
