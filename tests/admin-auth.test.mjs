import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { verifyAdminAuthorization, adminChallenge } from "../lib/admin-auth.ts";
const credential = "owner:local-test-only-high-entropy-fixture";
const hash = createHash("sha256").update(credential).digest("hex");
const header = "Basic " + Buffer.from(credential).toString("base64");
test("validates owner credentials and fails closed without configuration", async () => {
  assert.equal(await verifyAdminAuthorization(header, hash), true);
  assert.equal(await verifyAdminAuthorization(header, undefined), false);
  assert.equal(await verifyAdminAuthorization(null, hash), false);
});
test("rejects invalid password, user, format and oversized input", async () => {
  for (const value of [
    "Basic " + btoa("owner:wrong"),
    "Basic " + btoa("guest:" + credential.split(":")[1]),
    "Bearer " + header,
    "Basic !!!",
    header + "x",
    "Basic " + "a".repeat(513),
  ])
    assert.equal(await verifyAdminAuthorization(value, hash), false);
});
test("challenges without cacheable or indexable private response", () => {
  const response = adminChallenge();
  assert.equal(response.status, 401);
  assert.match(response.headers.get("www-authenticate"), /^Basic /);
  assert.match(response.headers.get("cache-control"), /no-store/);
  assert.equal(response.headers.get("vary"), "Authorization");
});
