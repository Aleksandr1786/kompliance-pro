const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const contract = fs.readFileSync(path.join(root, "docs", "sync-clients-contract.v1.md"), "utf8");
const main = fs.readFileSync(path.join(root, "main.js"), "utf8");

test("sync contract v1 is documented", () => {
  assert.match(contract, /Версия протокола: 1/);
  assert.match(contract, /POST/);
  assert.match(contract, /\/api\/sync-clients/);
  assert.match(contract, /conflict: true/);
  assert.match(contract, /deleted_client_ids/);
});

test("desktop implements the documented sync response", () => {
  for (const marker of [
    "/api/sync-clients",
    "desktop_local_id",
    "cloud_id",
    "updated_at",
    "pulled_clients",
    "pulled_employees",
    "deleted_client_ids",
    "deleted_employee_ids",
    "conflict"
  ]) {
    assert.ok(main.includes(marker), `main.js must contain ${marker}`);
  }
});
