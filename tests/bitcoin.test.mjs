import test from "node:test";
import assert from "node:assert/strict";
import {
  blocksRemaining,
  estimateArrival,
  subsidy,
  validBlocks,
} from "../lib/bitcoin.ts";
const block = (height, id, previousblockhash) => ({
  height,
  id: id.repeat(64),
  previousblockhash: previousblockhash?.repeat(64),
  timestamp: 1700000000,
  tx_count: 500,
  size: 1000000,
  weight: 4000000,
});
test("counts height to the target and never negative after it", () => {
  assert.equal(blocksRemaining(999999), 1);
  assert.equal(blocksRemaining(1000000), 0);
  assert.equal(blocksRemaining(1000001), 0);
});
test("ETA is anchored to the observed block, not each render", () => {
  assert.equal(estimateArrival(block(999999, "a", "b")), 1700000600000);
});
test("million is not a halving and next halving changes subsidy", () => {
  assert.equal(subsidy(999999), 3.125);
  assert.equal(subsidy(1000000), 3.125);
  assert.equal(subsidy(1049999), 3.125);
  assert.equal(subsidy(1050000), 1.5625);
});
test("validates consecutive hashes as well as heights", () => {
  assert.equal(validBlocks([block(100, "a", "b"), block(99, "b", "c")]), true);
  assert.equal(validBlocks([block(100, "a", "c"), block(99, "b", "c")]), false);
  assert.equal(validBlocks([block(100, "a", "b"), block(98, "b", "c")]), false);
});
test("rejects malformed and empty upstream data", () => {
  assert.equal(validBlocks([]), false);
  assert.equal(validBlocks([{ ...block(100, "a", "b"), height: 1.5 }]), false);
  assert.equal(
    validBlocks([{ ...block(100, "a", "b"), id: "<script>" }]),
    false,
  );
  assert.equal(
    validBlocks([{ ...block(100, "a", "b"), timestamp: Date.now() }]),
    false,
  );
});
