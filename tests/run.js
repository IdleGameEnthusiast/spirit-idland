#!/usr/bin/env node
/* Regression harness for the round loop - docs/spec/08-acceptance-tests.md.
 *
 * Usage: node tests/run.js [name-filter]
 *
 * No dependencies and no build step, on purpose: the game itself is two classic scripts
 * a browser can open from disk, and the tests should not need more tooling than that. */

const fs = require("fs");
const path = require("path");
const harness = require("./harness.js");

const filter = process.argv[2] || "";

const files = fs.readdirSync(__dirname)
  .filter((name) => name.endsWith(".test.js"))
  .sort();

for (const file of files) require(path.join(__dirname, file));

const results = { passed: 0, failed: 0 };
const failures = [];

for (const entry of harness.registry) {
  if (filter && !entry.name.toLowerCase().includes(filter.toLowerCase())) continue;
  try {
    entry.fn();
    results.passed += 1;
  } catch (error) {
    results.failed += 1;
    failures.push({ name: entry.name, error });
  }
}

for (const failure of failures) {
  console.log(`FAIL  ${failure.name}`);
  console.log(`      ${failure.error.message}`);
}

const total = results.passed + results.failed;
console.log(`\n${results.passed}/${total} checks passed${results.failed ? `, ${results.failed} failed` : ""}.`);

process.exit(results.failed > 0 ? 1 : 0);
