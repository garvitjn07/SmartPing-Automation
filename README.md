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
- `steps_file.js` - custom step helpers
- `codecept.conf.js` - CodeceptJS configuration
- `output-smartping/` - generated reports and screenshots

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
