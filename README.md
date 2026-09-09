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
npm test
```

Run in headless mode:

```bash
HEADLESS=true npm test
```

This splits the 75 workbook rows across four concurrent processes and then
merges their output, so a run finishes with exactly one of each artefact:

```text
output-smartping/smartping-report.html           merged HTML report (all 75)
output-smartping/smartping-report.json           merged report data
output-smartping/smartping-verdict-summary.xlsx  merged verdict summary
output-smartping/chunk-1 .. chunk-4/             per-chunk working output
```

## Parallel Execution

The suite runs as **four processes, 19 test cases each** - the last one takes
the 18 rows that remain. The rows are split into contiguous slices, and each
process runs its own slice **in worksheet order** against a single browser
session:

| Process | Rows | Test cases |
| --- | --- | --- |
| `chunk-1` | 1-19 | `TC_01` - `TC_19` |
| `chunk-2` | 20-38 | `TC_20` - `TC_38` |
| `chunk-3` | 39-57 | `TC_39` - `TC_57` |
| `chunk-4` | 58-75 | `TC_58` - `TC_75` |

Parallelism comes from running four configs at once rather than from
`run-workers`: workers would split the rows unpredictably and each worker
would emit its own report.

`npm test` starts all four, prefixes their logs with `[chunk-N]`, waits for
them, then merges. It exits non-zero if any chunk had a failing test case.

Each process writes into its own `output-smartping/chunk-N/` folder while it
runs, which is what keeps four concurrent Mochawesome reporters from
overwriting one another. The merge step reads those folders back **in chunk
order**, so the single report and the single spreadsheet both run `TC_01`
through `TC_75` top to bottom.

### Running a single chunk

Useful when re-running one slice, or for debugging in four terminal windows:

```bash
npm run test:chunk1     # rows 1-19   (also chunk2 .. chunk4)
npm run report:merge    # merge whatever chunks have output
```

To run all 75 rows in one process, in order, with no splitting:

```bash
npm run test:single
```

### Running a few rows for testing

There are two caps, and they trim at different points:

| Variable | Trims | Use it for |
| --- | --- | --- |
| `ROWS_PER_CHUNK` | the first N rows **of each chunk's own range** | smoke-testing the parallel run |
| `ROW_LIMIT` | the first N rows **of the workbook**, before splitting | shortening a single-process run |

To put all four chunks on the wire with one row each - the fastest full check
of the parallel split and the merge:

```bash
npm run test:smoke:parallel     # ROWS_PER_CHUNK=1, four chunks, four browsers
```

Each chunk keeps its real range and takes the first row of it, so the run
covers `TC_01`, `TC_20`, `TC_39` and `TC_58` rather than crowding
`TC_01` - `TC_04` into it:

| Process | Rows | Test case |
| --- | --- | --- |
| `chunk-1` | 1-19 | `TC_01` |
| `chunk-2` | 20-38 | `TC_20` |
| `chunk-3` | 39-57 | `TC_39` |
| `chunk-4` | 58-75 | `TC_58` |

Raise it for more per chunk - `ROWS_PER_CHUNK=5 npm test` runs 20 test cases,
five per chunk in series, which exercises both the parallelism and the
in-order run inside a chunk:

```bash
ROWS_PER_CHUNK=5 npm test
```

`ROW_LIMIT` instead trims the workbook before it is split, which suits a
single-process run:

```bash
npm run test:smoke                # rows 1-5, one process
ROW_LIMIT=10 npm run test:single  # rows 1-10, one process
```

To pick out specific test cases instead of the first N, use Codecept's own
`--grep` against the scenario titles:

```bash
CHUNK_COUNT=1 npx codeceptjs run --config codecept.conf.js --grep "TC_3[0-5]"
```

The merge step works the same on a trimmed run, so `npm run report:merge`
still produces one report, one JSON and one spreadsheet for whatever ran.

### Tuning

| Variable | Meaning |
| --- | --- |
| `CHUNK_COUNT` | Number of parallel processes (default `4`) |
| `CHUNK` | Zero-based slice a process runs (`0` - `CHUNK_COUNT - 1`) |
| `ROW_LIMIT` | Use only the first N workbook rows (whole run, before splitting) |
| `ROWS_PER_CHUNK` | Use only the first N rows of each chunk's own range |
| `HEADLESS` | `true` to run Chrome headless |
| `PAUSE_ON_FAIL` | `1` to re-enable the interactive pause on failure |

```bash
CHUNK_COUNT=3 npm test   # 75 rows -> 3 x 25
```

`pauseOnFail` is off by default: a paused chunk waits for a keypress that
never comes when four processes run unattended, which would stall the run.

## Compliance Result Capture

After **Check compliance** runs, the result screen is split into two tabs. Each
test case captures both:

1. The suite waits up to **60 seconds** for the **Overview** / **Findings** tabs
   to appear. They only render once the AI review has returned, so they are the
   signal that the result is ready. **If they do not appear within 60 seconds the
   test case fails** — there is no fixed sleep here, so a fast review proceeds
   immediately.
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
- collected into a single spreadsheet written at the end of the run:

```text
output-smartping/smartping-verdict-summary.xlsx
```

Each chunk drops its rows into a `verdict-summary.part.json` inside its own
folder while it runs; the merge step orders those partials by row number and
writes the one spreadsheet covering all 75 rows.

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
- `util/chunkPlan.js` - how the workbook rows are split across processes
- `scripts/run-parallel.js` - launches the four chunks, then merges
- `scripts/merge-reports.js` - merges the chunks into one report/JSON/spreadsheet
- `steps_file.js` - custom step helpers
- `codecept.conf.js` - CodeceptJS configuration (chunk-aware)
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

Run the suite (4 parallel chunks, then merge):

```bash
npm test
```

Run in headless mode:

```bash
HEADLESS=true npm test
```

Run a short smoke test:

```bash
npm run test:smoke:parallel   # 4 chunks x 1 row, in parallel
npm run test:smoke            # rows 1-5, one process
```

Re-merge existing chunk output without re-running the tests:

```bash
npm run report:merge
```
