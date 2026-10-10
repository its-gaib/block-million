import test from "node:test";
import assert from "node:assert/strict";
import {
  BLOCK_MILESTONES,
  GENESIS_TIMESTAMP,
  formatHashrate,
  milestoneBlockSource,
  milestoneHashrateSource,
} from "../lib/milestones.ts";

test("milestones preserve verified headers and missing early exchange prices", () => {
  assert.deepEqual(BLOCK_MILESTONES.map((block) => block.height), [1, 10, 100, 1000, 10000, 100000]);
  for (const [index, block] of BLOCK_MILESTONES.entries()) {
    assert.match(block.hash, /^[0-9a-f]{64}$/);
    assert.equal(new URL(milestoneBlockSource(block)).pathname, `/block/${block.hash}`);
    assert.equal(new URL(milestoneHashrateSource(block)).searchParams.get("start"), new Date(block.timestamp * 1000).toISOString().slice(0, 10));
    assert.ok(block.timestamp > (BLOCK_MILESTONES[index - 1]?.timestamp ?? GENESIS_TIMESTAMP));
    assert.ok(block.dailyHashrate > 0);
    assert.ok(block.transactions >= 1 && block.bytes >= 215);
    if (index < 5) assert.equal(block.priceUsd, null);
  }
  assert.equal(BLOCK_MILESTONES.at(-1).priceUsd, 0.29);
  assert.equal(new Date(BLOCK_MILESTONES.at(-1).timestamp * 1000).toISOString(), "2010-12-29T11:57:43.000Z");
  assert.equal(BLOCK_MILESTONES[0].dailyHashrate, BLOCK_MILESTONES[1].dailyHashrate);
});

test("hashrate formatting does not confuse H/s with provider TH/s", () => {
  assert.equal(formatHashrate(BLOCK_MILESTONES[0].dailyHashrate), "695.9 kH/s");
  assert.equal(formatHashrate(BLOCK_MILESTONES.at(-1).dailyHashrate), "123.8 GH/s");
  assert.equal(formatHashrate(1e18), "1 EH/s");
  assert.equal(formatHashrate(null), "Unavailable");
  assert.equal(formatHashrate(NaN), "Unavailable");
});
