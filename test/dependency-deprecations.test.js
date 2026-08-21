"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  evaluateDeprecations,
  parseDeprecations,
} = require("../scripts/check-dependency-deprecations");

const baseline = {
  schemaVersion: 1,
  reviewAfter: "2026-10-01",
  warnings: [
    { package: "glob", version: "7.2.3" },
    { package: "@scope/example", version: "1.2.3" },
  ],
};

test("parses and deduplicates npm deprecation warnings", () => {
  const warnings = parseDeprecations(`
npm warn deprecated glob@7.2.3: Glob versions prior to v9 are unsupported
npm WARN deprecated @scope/example@1.2.3: Deprecated
npm warn deprecated glob@7.2.3: repeated
`);

  assert.deepEqual(
    warnings.map(({ package: name, version }) => ({ name, version })),
    [
      { name: "@scope/example", version: "1.2.3" },
      { name: "glob", version: "7.2.3" },
    ]
  );
});

test("accepts the exact reviewed baseline before its review date", () => {
  const actual = baseline.warnings.map((entry) => ({ ...entry, message: "x" }));
  const result = evaluateDeprecations(
    actual,
    baseline,
    new Date("2026-08-21T00:00:00Z")
  );

  assert.deepEqual(result.unexpected, []);
  assert.deepEqual(result.resolved, []);
  assert.equal(result.reviewExpired, false);
});

test("detects a newly introduced deprecation", () => {
  const result = evaluateDeprecations(
    [{ package: "new-package", version: "1.0.0", message: "x" }],
    baseline,
    new Date("2026-08-21T00:00:00Z")
  );

  assert.deepEqual(
    result.unexpected.map(({ package: name }) => name),
    ["new-package"]
  );
});

test("detects baseline entries that disappeared", () => {
  const result = evaluateDeprecations(
    [{ package: "glob", version: "7.2.3", message: "x" }],
    baseline,
    new Date("2026-08-21T00:00:00Z")
  );

  assert.deepEqual(
    result.resolved.map(({ package: name }) => name),
    ["@scope/example"]
  );
});

test("requires periodic review of accepted upstream debt", () => {
  const actual = baseline.warnings.map((entry) => ({ ...entry, message: "x" }));
  const result = evaluateDeprecations(
    actual,
    baseline,
    new Date("2026-10-02T00:00:00Z")
  );

  assert.equal(result.reviewExpired, true);
});
