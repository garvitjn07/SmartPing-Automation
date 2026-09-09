const assert = require("assert");

module.exports = function () {
  return actor({
    async clickElement(locator) {
      assert.ok(
        await tryTo(() => this.waitForElement(locator, 20)),
        `Element "${locator}" is not available for click`,
      );
      await this.click(locator);
    },

    async fillValue(locator, value) {
      assert.ok(
        await tryTo(() => this.waitForElement(locator, 20)),
        `Element "${locator}" is not available for input`,
      );
      await this.fillField(locator, value);
    },
  });
};
