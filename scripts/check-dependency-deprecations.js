"use strict";

const fs = require("node:fs");
const path = require("node:path");

function warningKey(entry) {
  return `${entry.package}@${entry.version}`;
}

function parseDeprecations(log) {
  const warnings = new Map();

  for (const rawLine of log.split(/\r?\n/)) {
    const line = rawLine.trim();
    const match = line.match(/^npm (?:warn|WARN) deprecated\s+(.+)@([^@\s]+):\s*(.+)$/);
    if (!match) continue;

    const entry = {
      package: match[1],
      version: match[2],
      message: match[3],
    };
    warnings.set(warningKey(entry), entry);
  }

  return [...warnings.values()].sort((a, b) =>
    warningKey(a).localeCompare(warningKey(b))
  );
}

function evaluateDeprecations(actual, baseline, today = new Date()) {
  if (baseline.schemaVersion !== 1 || !Array.isArray(baseline.warnings)) {
    throw new Error("Unsupported dependency-deprecation baseline format");
  }

  const allowed = new Map(
    baseline.warnings.map((entry) => [warningKey(entry), entry])
  );
  const observed = new Map(actual.map((entry) => [warningKey(entry), entry]));

  const unexpected = actual.filter((entry) => !allowed.has(warningKey(entry)));
  const resolved = baseline.warnings.filter(
    (entry) => !observed.has(warningKey(entry))
  );

  const reviewAfter = new Date(`${baseline.reviewAfter}T23:59:59.999Z`);
  if (Number.isNaN(reviewAfter.getTime())) {
    throw new Error("Invalid reviewAfter date in dependency-deprecation baseline");
  }

  return {
    unexpected,
    resolved,
    reviewExpired: today.getTime() > reviewAfter.getTime(),
  };
}

function formatEntries(entries) {
  return entries.map((entry) => `  - ${warningKey(entry)}`).join("\n");
}

function run(logPath, baselinePath, today = new Date()) {
  const log = fs.readFileSync(logPath, "utf8");
  const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
  const actual = parseDeprecations(log);
  const result = evaluateDeprecations(actual, baseline, today);

  console.log(`Dependency deprecations observed: ${actual.length}`);
  if (actual.length) console.log(formatEntries(actual));

  const errors = [];
  if (result.unexpected.length) {
    errors.push(
      `New dependency deprecations are not allowed:\n${formatEntries(
        result.unexpected
      )}`
    );
  }
  if (result.resolved.length) {
    errors.push(
      `Baseline contains warnings that disappeared; remove them:\n${formatEntries(
        result.resolved
      )}`
    );
  }
  if (result.reviewExpired) {
    errors.push(
      `Dependency-deprecation review expired on ${baseline.reviewAfter}`
    );
  }

  if (errors.length) {
    throw new Error(errors.join("\n\n"));
  }

  console.log(
    `Deprecation baseline accepted; next review by ${baseline.reviewAfter}`
  );
}

if (require.main === module) {
  const logPath = process.argv[2];
  const baselinePath =
    process.argv[3] ||
    path.join(__dirname, "..", "config", "dependency-deprecations.json");

  if (!logPath) {
    console.error(
      "Usage: node scripts/check-dependency-deprecations.js <npm-log> [baseline]"
    );
    process.exit(2);
  }

  try {
    run(logPath, baselinePath);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = {
  evaluateDeprecations,
  parseDeprecations,
  run,
  warningKey,
};
