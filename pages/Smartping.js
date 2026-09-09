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
};

module.exports = {
  credentials,

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

  async runAiReview(screenshotName) {
    // Compliance opens a separate results view, so wait before capturing it.
    await I.clickElement(this.locators.buttons.checkCompliance);
    await I.wait(waitTime.aiReview);

    const screenshotPath = `${screenshotName}-full-page.png`;
    await I.saveScreenshot(screenshotPath, true);

    // Embed the image in the report instead of linking to a browser-inaccessible file path.
    const screenshotFile = path.join(
      process.cwd(),
      "output-smartping",
      screenshotPath,
    );
    const screenshotData = fs.readFileSync(screenshotFile).toString("base64");
    await I.addMochawesomeContext({
      title: "AI review full-page screenshot",
      value: `data:image/png;base64,${screenshotData}`,
    });
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
