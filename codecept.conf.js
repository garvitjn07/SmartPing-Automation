// require("dotenv").config(); // Load environment variables from .env file
const { setHeadlessWhen, setCommonPlugins } = require("@codeceptjs/configure");

// turn on headless mode when running with HEADLESS=true environment variable
// export HEADLESS=true && npx codeceptjs run
setHeadlessWhen(process.env.HEADLESS);

// enable all common plugins https://github.com/codeceptjs/configure#setcommonplugins
setCommonPlugins();

// Enable XLS-backed data-driven scenarios.
process.env.DATA_FROM_FILE = 1;

const outputDir = "output-smartping";
const fs = require("fs");
/** @type {CodeceptJS.MainConfig} */
exports.config = {
  // each test must not run longer than 15 mins - browser close time
  timeout: 1860,
  tests: ["testcases/SmartPing_test.js"],
  output: `./${outputDir}`,
  helpers: {
    WebDriver: {
      url: "https://smartping.openturf.dev/",
      browser: "chrome",
      desiredCapabilities: {
        chromeOptions: {
          args: ["--ignore-certificate-errors"], //"--headless"
        },
      },
      windowSize: "maximize",
      // if timeout and delete cookies problems are facing then start each session in a new browser restart : true
      restart: false, //keeps the same browser session across the entire test suite, ensuring that the WebDriver is already up and running when BeforeSuite executes — which is why I.amOnPage() started working.
      keepBrowserState: true,

      remoteFileUpload: false,
    },

    Mochawesome: {
      uniqueScreenshotNames: false,
    },
    Report: {
      require: "./util/helpers/Report.js",
    },
  },
  include: {
    I: "./steps_file.js",
    smartpingPage: "./pages/Smartping.js",
  },
  name: "smartping",

  // Start each run with a clean report directory.
  bootstrap: async () => {
    fs.rmSync(`./${outputDir}`, { recursive: true, force: true });
    fs.mkdirSync(`./${outputDir}`, { recursive: true });
  },
  mocha: {
    reporterOptions: {
      reportDir: outputDir,
      reportFilename: "smartping-report",
      overwrite: true,
      inlineAssets: true,
    },
  },
  plugins: {
    FileSystem: {},
    pauseOnFail: {},
    retryFailedStep: {
      enabled: true,
    },
    tryTo: {
      enabled: true,
    },
    screenshotOnFail: {
      enabled: true,
    },
  },
};
