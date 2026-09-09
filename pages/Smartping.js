const { I } = inject();
const fs = require("fs");
const path = require("path");

const credentials = {
  webUrl: "https://smartping.openturf.dev/",
  password: "smartping-dlt",
};

const waitTime = {
  pageLoad: 20,
  aiReview: 20,
  // Pause requested between the Overview and Findings captures.
  betweenTabs: 5,
  // Short settle after switching tabs so the panel is fully painted.
  tabRender: 2,
};

// Verdict values the Compliance screen can report.
const VERDICTS = ["PASS", "WARN", "FAIL"];
const UNKNOWN_VERDICT = "N/A";

module.exports = {
  credentials,
  waitTime,
  VERDICTS,
  UNKNOWN_VERDICT,

  locators: {
    inputs: {
      password: "//input[@placeholder='Enter demo password']",
      templateName: "//input[@placeholder='Enter Template Name']",
      principalEntity:
        "//input[@placeholder='Brand / Business name (mandatory in content)']",
      header:
        "//input[@placeholder='Sender ID(s) — alphanumeric ≤11; comma-separate for multiple']",
      message:
        "//textarea[@placeholder='Type or paste the template content. Use {#var#} for variables — they are detected automatically.']",
      // Reserved for the next phase when variable inputs are enabled.
      //   variable: (number) =>
      //     `(//input[@placeholder='Enter Sample Value'])[${number}]`,
    },
    buttons: {
      login: "//button[@type='submit']",
      entityRegistration: "//button[normalize-space()='Entity Registration']",
      // Reserved for the next phase when variable inputs are enabled.
      // addVariable: "//button[contains(normalize-space(), 'Add Variable Tag')]",
      checkCompliance: "//button[normalize-space()='Check compliance']",
      clearForm: "//button[contains(normalize-space(), 'Clear / Reset')]",
    },
    // The AI compliance result is split across two tabs.
    tabs: {
      overview: "//button[normalize-space()='Overview']",
      findings: "//button[normalize-space()='Findings']",
    },
    // PASS / WARN / FAIL chip rendered next to the "Verdict" heading.
    verdictBadge:
      "(//h3[normalize-space()='Verdict']/following-sibling::span[1])[1]",
  },

  async navigateToLogin() {
    // Open the access-gated Smartping page and wait for its password field.
    await I.amOnPage(this.credentials.webUrl);
    await I.waitForElement(this.locators.inputs.password, waitTime.pageLoad);
  },

  /**
   * Opens Smartping and submits the demo password.
   * @param {string} password - Smartping demo password.
   */
  async login(password = this.credentials.password) {
    // This method is called once from BeforeSuite; the session remains open.
    await this.navigateToLogin();
    await I.fillValue(this.locators.inputs.password, password);
    await I.clickElement(this.locators.buttons.login);
    await I.waitForElement(
      this.locators.inputs.templateName,
      waitTime.pageLoad,
    );
  },

  /**
   * Fills the four active DLT template inputs used by every test case.
   * @param {object} data - Template data from the test data file.
   * @param {string} data.templateName - DLT template name.
   * @param {string} data.principalEntity - Principal entity or brand name.
   * @param {string} data.message - Template message content.
   */
  async fillTemplateData(data) {
    const entityName = data.entityName || data.principalEntity;
    const templateName = data.templateName || entityName;

    await I.fillValue(this.locators.inputs.templateName, templateName);
    await I.fillValue(this.locators.inputs.principalEntity, entityName);
    await I.fillValue(this.locators.inputs.header, data.header);
    await I.fillValue(this.locators.inputs.message, data.message);

    // Variable 1-4 support is temporarily disabled and will be enabled later.
    // for (let number = 1; number <= 4; number += 1) {
    //   const value = data[`variable${number}`];
    //   if (value === undefined || value === null || value === "") continue;

    //   const variableInput = this.locators.inputs.variable(number);
    //   while ((await I.grabNumberOfVisibleElements(variableInput)) === 0) {
    //     await I.clickElement(this.locators.buttons.addVariable);
    //   }
    //   await I.fillValue(variableInput, value);
    // }
  },

  /**
   * Reads the PASS / WARN / FAIL chip from the Verdict card. The card sits
   * above the tab strip, so it is readable from either tab.
   * @returns {Promise<string>} "PASS", "WARN", "FAIL" or "N/A" when unreadable.
   */
  async grabVerdictStatus() {
    if ((await I.grabNumberOfVisibleElements(this.locators.verdictBadge)) === 0)
      return UNKNOWN_VERDICT;

    const grabbed = await I.grabTextFrom(this.locators.verdictBadge);
    // grabTextFrom returns an array when the locator matches more than once.
    const text = (Array.isArray(grabbed) ? grabbed[0] : grabbed) || "";
    const verdict = text.trim().toUpperCase();

    return VERDICTS.includes(verdict) ? verdict : verdict || UNKNOWN_VERDICT;
  },

  /**
   * Saves a full-page screenshot and embeds it in the Mochawesome report.
   * @param {string} fileName - Screenshot file name inside the output folder.
   * @param {string} title - Caption shown above the image in the report.
   */
  async attachFullPageScreenshot(fileName, title) {
    await I.saveScreenshot(fileName, true);

    // Embed the image in the report instead of linking to a browser-inaccessible file path.
    const screenshotFile = path.join(
      global.output_dir || path.join(process.cwd(), "output-smartping"),
      fileName,
    );
    const screenshotData = fs.readFileSync(screenshotFile).toString("base64");
    await I.addMochawesomeContext({
      title,
      value: `data:image/png;base64,${screenshotData}`,
    });
  },

  /**
   * Runs the AI compliance check, then captures the Overview tab, waits, and
   * captures the Findings tab. Both images are attached to the report.
   * @param {string} screenshotName - Test case id used as the file name prefix.
   * @returns {Promise<string>} The verdict status for the report summary.
   */
  async runAiReview(screenshotName) {
    // Compliance opens a separate results view, so wait before capturing it.
    await I.clickElement(this.locators.buttons.checkCompliance);
    await I.wait(waitTime.aiReview);

    const verdict = await this.grabVerdictStatus();
    await I.say(`Verdict: ${verdict}`);
    await I.addMochawesomeContext({
      title: "Verdict status",
      value: verdict,
    });

    // The tab strip only renders when the AI returns overview data; without it
    // the result stays on a single scrollable page.
    const hasTabs =
      (await I.grabNumberOfVisibleElements(this.locators.tabs.overview)) > 0;

    if (!hasTabs) {
      await this.attachFullPageScreenshot(
        `${screenshotName}-full-page.png`,
        `AI review full-page screenshot — verdict: ${verdict}`,
      );
      return verdict;
    }

    await I.clickElement(this.locators.tabs.overview);
    await I.wait(waitTime.tabRender);
    await this.attachFullPageScreenshot(
      `${screenshotName}-overview-full-page.png`,
      `Overview tab — verdict: ${verdict}`,
    );

    // Requested pause between the two captures.
    await I.wait(waitTime.betweenTabs);

    await I.clickElement(this.locators.tabs.findings);
    await I.wait(waitTime.tabRender);
    await this.attachFullPageScreenshot(
      `${screenshotName}-findings-full-page.png`,
      `Findings tab — verdict: ${verdict}`,
    );

    return verdict;
  },

  async resetTemplateForm() {
    // Return from Compliance to Entity Registration before clearing the form.
    await I.clickElement(this.locators.buttons.entityRegistration);
    await I.waitForElement(
      this.locators.inputs.templateName,
      waitTime.pageLoad,
    );
    await I.clickElement(this.locators.buttons.clearForm);
  },
};
