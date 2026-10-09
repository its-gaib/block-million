import test from "node:test";
import assert from "node:assert/strict";
import {
  BLOCK_MILESTONES,
  GENESIS_TIMESTAMP,
  chartFraction,
  daysSinceGenesis,
  formatHashrate,
  linearChartMaximum,
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

test("elapsed days use seconds, preserve fractions, and reject missing or pre-genesis dates", () => {
  assert.equal(daysSinceGenesis(GENESIS_TIMESTAMP), 0);
  assert.equal(daysSinceGenesis(GENESIS_TIMESTAMP + 129600), 1.5);
  for (const value of [null, undefined, NaN, Infinity, GENESIS_TIMESTAMP - 1]) assert.equal(daysSinceGenesis(value), null);
});

test("log-log coordinates put multiplicative steps at equal distances on either axis", () => {
  assert.equal(chartFraction(1, 1, 1e6, "log"), 0);
  assert.equal(chartFraction(1000, 1, 1e6, "log"), 0.5);
  assert.equal(chartFraction(1e6, 1, 1e6, "log"), 1);
  assert.equal(chartFraction(1e9, 1e6, 1e12, "log"), 0.5);
  assert.equal(chartFraction(500000, 0, 1e6, "linear"), 0.5);
  for (const value of [0, -1, NaN, Infinity]) assert.equal(chartFraction(value, 1, 1e6, "log"), null);
  assert.equal(chartFraction(1, 0, 1e6, "log"), null);
  assert.equal(chartFraction(1, 2, 2, "linear"), null);
});

test("hashrate formatting does not confuse H/s with provider TH/s", () => {
  assert.equal(formatHashrate(BLOCK_MILESTONES[0].dailyHashrate), "695.9 kH/s");
  assert.equal(formatHashrate(BLOCK_MILESTONES.at(-1).dailyHashrate), "123.8 GH/s");
  assert.equal(formatHashrate(1e18), "1 EH/s");
  assert.equal(formatHashrate(null), "Unavailable");
  assert.equal(formatHashrate(NaN), "Unavailable");
  assert.equal(linearChartMaximum(957), 1000);
  assert.equal(linearChartMaximum(1.3e21), 2e21);
  assert.equal(linearChartMaximum(0), 1);
});
