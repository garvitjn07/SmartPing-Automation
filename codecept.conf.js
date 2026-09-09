// require("dotenv").config(); // Load environment variables from .env file
const { setHeadlessWhen, setCommonPlugins } = require("@codeceptjs/configure");
const chunkPlan = require("./util/chunkPlan");

// turn on headless mode when running with HEADLESS=true environment variable
// export HEADLESS=true && npx codeceptjs run
setHeadlessWhen(process.env.HEADLESS);

// enable all common plugins https://github.com/codeceptjs/configure#setcommonplugins
setCommonPlugins();

// Enable XLS-backed data-driven scenarios.
process.env.DATA_FROM_FILE = 1;

// The suite is split across CHUNK_COUNT processes (5 by default) and this
// process runs the slice named by CHUNK. Every chunk writes into its own
// output folder so five concurrent runs never fight over the same report
// file; `npm run report:merge` folds them into one report afterwards.
const chunkIndex = chunkPlan.chunkIndex();
const chunkName = chunkPlan.chunkName(chunkIndex);
const outputDir = chunkPlan.chunkOutputDir(chunkIndex);

/** @type {CodeceptJS.MainConfig} */
exports.config = {
  // each test must not run longer than 15 mins - browser close time
  timeout: 1860,

  // Parallelism comes from running several of these configs at once, not from
  // run-workers: workers would split the rows unpredictably and each worker
  // would emit its own report.
  tests: ["testcases/SmartPing_test.js"],
  output: `./${outputDir}`,

  // Start every run from a clean chunk folder so the merge step finds exactly
  // one report per chunk instead of the leftovers of previous runs.
  emptyOutputFolder: true,

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

    // Report entries are added explicitly from the page object, so every
    // low-level wait/click is deliberately kept out of the report.
    Mochawesome: {
      uniqueScreenshotNames: false,
    },
  },
  include: {
    I: "./steps_file.js",
    smartpingPage: "./pages/Smartping.js",
  },
  name: `smartping-${chunkName}`,

  mocha: {
    // Set here rather than passed as --reporter so every chunk, however it is
    // launched, produces the JSON the merge step needs.
    reporter: "mochawesome",
    reporterOptions: {
      reportDir: outputDir,
      reportFilename: chunkPlan.chunkReportName(chunkIndex),
      // The chunk folder is emptied on start, so a rerun replaces its report
      // instead of piling up smartping-chunk-1_001.json next to it.
      overwrite: true,
      inlineAssets: true,
      // Keep the scenario source out of the report - each test shows only its
      // reported steps, not the test body.
      code: false,
    },
  },
  plugins: {
    FileSystem: {},
    // Off by default: a paused chunk waits for a keypress that never comes
    // when five processes run unattended, stalling the whole run. Opt in with
    // PAUSE_ON_FAIL=1 while debugging a single chunk.
    pauseOnFail: {
      enabled: Boolean(process.env.PAUSE_ON_FAIL),
    },
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
