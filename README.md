# SmartPing Automation

This repository contains a CodeceptJS + WebDriver automation suite for the SmartPing DLT Compliance Assistant workflow.

## Prerequisites

Before you begin, make sure you have the following installed on your machine:

- Node.js (recommended: v18 or newer)
- npm
- Chrome or Chromium
- Git

## Setup

1. Clone the repository:

```bash
git clone <your-repository-url>
cd SmartPing-Automation
```

2. Install project dependencies:

```bash
npm install
```

3. Make sure the test data file exists in the repository. The automation expects the workbook at:

```text
testdata/Smartping Sample templates 8th Sept 2026.xlsx
```

4. Configure the test environment if needed:

- The test suite is configured in `codecept.conf.js`.
- The default browser is Chrome.
- The test uses `output-smartping/` for generated reports and screenshots.

## Run the Tests

Run the full suite:

```bash
npx codeceptjs run --steps --reporter mochawesome
```

Run in headless mode:

```bash
HEADLESS=true npx codeceptjs run --steps --reporter mochawesome
```

The generated reports and screenshots will be stored under:

```text
output-smartping/
```

## Compliance Result Capture

After **Check compliance** runs, the result screen is split into two tabs. Each
test case captures both:

1. The suite waits up to **30 seconds** for the **Overview** / **Findings** tabs
   to appear. They only render once the AI review has returned, so they are the
   signal that the result is ready. **If they do not appear within 30 seconds the
   test case fails** — there is no fixed sleep here.
2. The **Overview** tab is selected, its panel is waited for, and a full-page
   screenshot is saved as `<TCID>-overview-full-page.png`.
3. The suite waits 5 seconds.
4. The **Findings** tab is selected and saved as `<TCID>-findings-full-page.png`.

Both images are embedded in the Mochawesome report for that test case.

## Report Contents

The report deliberately records what the test did, not each underlying
wait/click. Every test case contains:

| Entry | Contents |
| --- | --- |
| `Template details entered` | The value filled into each input field |
| `Compliance check` | Whether the result loaded inside the timeout |
| `AI review result` | The verdict and the compliance score |
| `Overview tab — verdict: <status>` | Overview screenshot |
| `Tab switch` | The 5 second pause between captures |
| `Findings tab — verdict: <status>` | Findings screenshot |

## Verdict Summary

The Verdict card reports a status of `PASS`, `WARN` or `FAIL`, and the AI
Scoring Model card reports a compliance score out of 100. Both are:

- shown as an **AI review result** context entry in the HTML report, with the
  verdict also used in the caption of both screenshots;
- collected into a spreadsheet written at the end of the run:

```text
output-smartping/smartping-verdict-summary.xlsx
```

The sheet is named `Verdict Summary` and has these columns:

| Column | Usage |
| --- | --- |
| `TCID` | Test case id from the workbook |
| `Entity Name` | Entity / brand under review |
| `Header/CLI associated` | Header used for the submission |
| `Verdict` | `PASS`, `WARN`, `FAIL`, or `N/A` when unreadable |
| `Compliance Score` | The `/ 100` score, written as a number, or `N/A` |
| `Execution Status` | `passed` or `failed` for the scenario itself |
| `Notes` | Failure message when the scenario failed |

A verdict breakdown is also printed to the console when the suite finishes.

## Recovering From a Failed Row

The browser session is shared by every row, so a row that fails mid-review would
otherwise leave the app on the Compliance screen and break every row after it.
An `After` hook returns to Entity Registration and clears the form after every
scenario, passed or failed. The reset is best effort and never throws, so it
cannot mask the failure that broke the test case.

## Important Notes

- The automation uses a workbook-driven flow.
- The configured sheet is `sampleSheet01`.
- The first row is treated as the header row, and data starts from row 2.
- Each row in the workbook represents one SmartPing template review submission.

Expected columns in the workbook:

| Column | Usage |
| --- | --- |
| `Entity Name` | Used for Template Name and Principal Entity (Brand) |
| `Header/CLI associated` | Used for Header(s) Associated |
| `Content` | Used for the message content |
| `Variable 1` to `Variable 4` | Reserved for future variable support |

> Variable input support is currently disabled.

## Project Structure

- `testcases/SmartPing_test.js` - main test flow
- `pages/Smartping.js` - page object / reusable actions
- `util/CommonUtils.js` - workbook loading helpers
- `util/helpers/VerdictSummary.js` - collects verdicts and writes the summary sheet
- `steps_file.js` - custom step helpers
- `codecept.conf.js` - CodeceptJS configuration
- `output-smartping/` - generated reports, screenshots, and verdict summary

## Git Workflow

Create a new branch for your changes:

```bash
git checkout -b your-branch-name
```

Make your edits, then stage files:

```bash
git add .
```

Commit your changes:

```bash
git commit -m "Describe your changes"
```

Push to the remote repository:

```bash
git push origin your-branch-name
```

If the branch is new and the remote does not know it yet, Git will usually show the exact push command to run.

## Common Commands

Install dependencies:

```bash
npm install
```

Run the suite:

```bash
npx codeceptjs run --steps --reporter mochawesome
```

Run in headless mode:

```bash
HEADLESS=true npx codeceptjs run --steps --reporter mochawesome
```
