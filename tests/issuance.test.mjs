import test from "node:test";
import assert from "node:assert/strict";
import { blockSubsidySatoshis, scheduledIssuedSatoshis } from "../lib/issuance.ts";

test("scheduled issuance includes the selected block and switches subsidy at each boundary", () => {
  const cases = [
    [0, 50, 50],
    [209999, 10500000, 50],
    [210000, 10500025, 25],
    [419999, 15750000, 25],
    [420000, 15750012.5, 12.5],
    [629999, 18375000, 12.5],
    [630000, 18375006.25, 6.25],
    [839999, 19687500, 6.25],
    [840000, 19687503.125, 3.125],
    [999999, 20187500, 3.125],
    [1000000, 20187503.125, 3.125],
  ];
  for (const [height, issued, subsidy] of cases) {
    assert.equal(scheduledIssuedSatoshis(height), issued * 100_000_000, `issuance at ${height}`);
    assert.equal(blockSubsidySatoshis(height), subsidy * 100_000_000, `subsidy at ${height}`);
    if (height > 0) assert.equal(scheduledIssuedSatoshis(height) - scheduledIssuedSatoshis(height - 1), blockSubsidySatoshis(height));
  }
});

test("sub-satoshi rewards truncate and issuance stops at the final subsidy", () => {
  assert.equal(blockSubsidySatoshis(32 * 210_000), 1);
  assert.equal(blockSubsidySatoshis(33 * 210_000), 0);
  assert.equal(scheduledIssuedSatoshis(33 * 210_000), 2_099_999_997_690_000);
  assert.equal(scheduledIssuedSatoshis(Number.MAX_SAFE_INTEGER), 2_099_999_997_690_000);
});

test("issuance helpers reject invalid block heights", () => {
  for (const value of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, "1000", null]) {
    assert.throws(() => scheduledIssuedSatoshis(value), RangeError);
    assert.throws(() => blockSubsidySatoshis(value), RangeError);
  }
});
