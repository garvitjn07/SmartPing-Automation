const { I } = inject();
const fs = require("fs");
const path = require("path");

const credentials = {
  webUrl: "https://smartping.openturf.dev/",
  password: "smartping-dlt",
};

const waitTime = {
  pageLoad: 20,
  // Longest the AI compliance result may take before the test case fails.
  // The review is a model call with variable latency; 30s was too tight and
  // timed out on templates that did eventually return.
  aiReview: 60,
  // Pause requested between the Overview and Findings captures.
  betweenTabs: 5,
  // Longest a tab panel may take to render after the tab is selected.
  tabPanel: 10,
  // Short settle so the panel is fully painted before the screenshot.
  paintSettle: 1,
};

// Verdict values the Compliance screen can report.
const VERDICTS = ["PASS", "WARN", "FAIL"];
const UNKNOWN = "N/A";

module.exports = {
  credentials,
  waitTime,
  VERDICTS,
  UNKNOWN,

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
    // Content markers proving the selected tab panel has rendered.
    panels: {
      overview: "//h3[starts-with(normalize-space(), 'Entities Found')]",
      findings: "//h3[normalize-space()='Findings']",
    },
    // PASS / WARN / FAIL chip rendered next to the "Verdict" heading.
    verdictBadge:
      "(//h3[normalize-space()='Verdict']/following-sibling::span[1])[1]",
    // The "NN" of "NN / 100 compliance" in the AI Scoring Model card.
    complianceScore:
      "(//span[normalize-space()='/ 100 compliance']/preceding-sibling::span[1])[1]",
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

    // Record what went into each field rather than the individual UI steps.
    await I.addMochawesomeContext({
      title: "Template details entered",
      value: {
        "Template Name": templateName,
        "Principal Entity (Brand)": entityName,
        "Header(s) Associated": data.header,
        "Message Content": data.message,
      },
    });

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
      return UNKNOWN;

    const grabbed = await I.grabTextFrom(this.locators.verdictBadge);
    // grabTextFrom returns an array when the locator matches more than once.
    const text = (Array.isArray(grabbed) ? grabbed[0] : grabbed) || "";
    const verdict = text.trim().toUpperCase();

    return VERDICTS.includes(verdict) ? verdict : verdict || UNKNOWN;
  },

  /**
   * Reads the "NN / 100 compliance" figure from the AI Scoring Model card,
   * which sits below the tabs and is present on either one.
   * @returns {Promise<number|string>} The score, or "N/A" when unreadable.
   */
  async grabComplianceScore() {
    if (
      (await I.grabNumberOfVisibleElements(this.locators.complianceScore)) === 0
    )
      return UNKNOWN;

    const grabbed = await I.grabTextFrom(this.locators.complianceScore);
    const text = (Array.isArray(grabbed) ? grabbed[0] : grabbed) || "";
    const score = Number.parseInt(text.trim(), 10);

    return Number.isNaN(score) ? UNKNOWN : score;
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
   * Selects a result tab, waits for its panel to render, and captures it.
   * @param {string} tab - "overview" or "findings".
   * @param {string} fileName - Screenshot file name.
   * @param {string} title - Caption shown above the image in the report.
   */
  async captureResultTab(tab, fileName, title) {
    await I.clickElement(this.locators.tabs[tab]);
    await I.waitForElement(this.locators.panels[tab], waitTime.tabPanel);
    await I.wait(waitTime.paintSettle);
    await this.attachFullPageScreenshot(fileName, title);
  },

  /**
   * Runs the AI compliance check, then captures the Overview tab, waits, and
   * captures the Findings tab. Both images are attached to the report.
   *
   * The result is waited for by element rather than by a fixed pause: if the
   * Overview / Findings tabs do not appear within the timeout the test case
   * fails.
   * @param {string} screenshotName - Test case id used as the file name prefix.
   * @returns {Promise<{verdict: string, complianceScore: number|string}>}
   *   The values recorded in the report summary.
   * @throws {Error} When the AI review result does not load in time.
   */
  async runAiReview(screenshotName) {
    await I.clickElement(this.locators.buttons.checkCompliance);

    // The tabs only render once the AI review has returned, so they are the
    // signal that the result is ready.
    const resultLoaded = await tryTo(() =>
      I.waitForElement(this.locators.tabs.overview, waitTime.aiReview),
    );

    if (!resultLoaded) {
      await I.addMochawesomeContext({
        title: "Compliance check",
        value: `Clicked "Check compliance", but the Overview / Findings tabs did not appear within ${waitTime.aiReview} seconds.`,
      });
      throw new Error(
        `AI review result did not load within ${waitTime.aiReview} seconds`,
      );
    }

    await I.addMochawesomeContext({
      title: "Compliance check",
      value: `Clicked "Check compliance"; the Overview / Findings tabs appeared within ${waitTime.aiReview} seconds.`,
    });

    const verdict = await this.grabVerdictStatus();
    const complianceScore = await this.grabComplianceScore();

    await I.say(`Verdict: ${verdict} | Compliance score: ${complianceScore}`);
    await I.addMochawesomeContext({
      title: "AI review result",
      value: {
        Verdict: verdict,
        "Compliance Score":
          complianceScore === UNKNOWN ? UNKNOWN : `${complianceScore} / 100`,
      },
    });

    await this.captureResultTab(
      "overview",
      `${screenshotName}-overview-full-page.png`,
      `Overview tab — verdict: ${verdict}`,
    );

    // Requested pause between the two captures.
    await I.wait(waitTime.betweenTabs);
    await I.addMochawesomeContext({
      title: "Tab switch",
      value: `Waited ${waitTime.betweenTabs} seconds after the Overview capture, then opened the Findings tab.`,
    });

    await this.captureResultTab(
      "findings",
      `${screenshotName}-findings-full-page.png`,
      `Findings tab — verdict: ${verdict}`,
    );

    return { verdict, complianceScore };
  },

  /**
   * Returns from Compliance to Entity Registration and clears the form.
   *
   * Best effort on purpose: this also runs after a failed row, where the app
   * may be stranded on another screen. It must never throw, or it would mask
   * the failure that actually broke the test case.
   * @returns {Promise<boolean>} Whether the form was reset.
   */
  async resetTemplateForm() {
    return tryTo(async () => {
      await I.clickElement(this.locators.buttons.entityRegistration);
      await I.waitForElement(
        this.locators.inputs.templateName,
        waitTime.pageLoad,
      );
      await I.clickElement(this.locators.buttons.clearForm);
    });
  },
};
