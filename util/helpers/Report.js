const Helper = require("@codeceptjs/helper");

class Report extends Helper {
  _afterStep(step) {
    return this.helpers["Mochawesome"].addMochawesomeContext(
      `✔ ${step.toString()}`
    );
  }
}

module.exports = Report;
