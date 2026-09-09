#!/usr/bin/env node
/**
 * Runs the suite as CHUNK_COUNT concurrent Codecept processes (5 by default),
 * each taking a contiguous slice of the worksheet in order, then merges their
 * output into a single report, JSON and spreadsheet.
 *
 *   npm run test:parallel            75 rows -> 5 x 15, then merge
 *   CHUNK_COUNT=3 npm run test:parallel
 *
 * Chunk output is prefixed with [chunk-N] so five interleaved logs stay
 * readable. Exits non-zero if any chunk failed.
 */
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const chunkPlan = require("../util/chunkPlan");

const projectRoot = path.join(__dirname, "..");
const codeceptBin = path.join(
  projectRoot,
  "node_modules",
  "codeceptjs",
  "bin",
  "codecept.js",
);

/** Prints a child stream line by line behind a chunk prefix. */
function pipePrefixed(stream, prefix, write) {
  let pending = "";

  stream.setEncoding("utf8");
  stream.on("data", (data) => {
    const lines = (pending + data).split("\n");
    pending = lines.pop();
    lines.forEach((line) => write(`${prefix} ${line}\n`));
  });
  stream.on("end", () => {
    if (pending) write(`${prefix} ${pending}\n`);
    pending = "";
  });
}

/** Launches one chunk and resolves with its exit code. */
function runChunk(index, chunkCount) {
  const name = chunkPlan.chunkName(index);
  const prefix = `[${name}]`;

  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      [codeceptBin, "run", "--config", "codecept.conf.js"],
      {
        cwd: projectRoot,
        env: {
          ...process.env,
          CHUNK: String(index),
          CHUNK_COUNT: String(chunkCount),
        },
        // stdin is closed: nothing in a parallel run may wait on a keypress.
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    pipePrefixed(child.stdout, prefix, (line) => process.stdout.write(line));
    pipePrefixed(child.stderr, prefix, (line) => process.stderr.write(line));

    child.on("error", (error) => {
      console.error(`${prefix} failed to start: ${error.message}`);
      resolve({ index, name, code: 1 });
    });

    child.on("close", (code, signal) => {
      const exitCode = code === null ? 1 : code;
      console.log(
        `${prefix} finished with ${signal ? `signal ${signal}` : `exit code ${exitCode}`}`,
      );
      resolve({ index, name, code: exitCode });
    });
  });
}

/** Runs the merge step as a child so its failure cannot mask a chunk failure. */
function runMerge() {
  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      [path.join(__dirname, "merge-reports.js")],
      { cwd: projectRoot, stdio: "inherit" },
    );

    child.on("error", () => resolve(1));
    child.on("close", (code) => resolve(code === null ? 1 : code));
  });
}

async function main() {
  const chunkCount = chunkPlan.chunkCount();
  const baseOutputDir = path.join(projectRoot, chunkPlan.BASE_OUTPUT_DIR);

  // Clear the whole output folder once, here, so the merged report of the
  // previous run cannot be mistaken for this one's. Each chunk then empties
  // only its own sub-folder as it starts.
  fs.rmSync(baseOutputDir, { recursive: true, force: true });
  fs.mkdirSync(baseOutputDir, { recursive: true });

  console.log(
    `Starting ${chunkCount} chunk(s) in parallel; each chunk runs its rows in order.\n`,
  );

  const results = await Promise.all(
    Array.from({ length: chunkCount }, (unused, index) =>
      runChunk(index, chunkCount),
    ),
  );

  const failed = results.filter((result) => result.code !== 0);
  console.log(
    `\nAll chunks finished. Passed: ${results.length - failed.length}/${results.length}.`,
  );
  if (failed.length) {
    console.log(`Chunks reporting failures: ${failed.map((r) => r.name).join(", ")}`);
  }

  // Merge whatever the chunks produced - a chunk with failing tests still has
  // a report worth folding in.
  const mergeCode = await runMerge();

  process.exitCode = failed.length || mergeCode !== 0 ? 1 : 0;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
