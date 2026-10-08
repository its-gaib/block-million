import test from "node:test";
import assert from "node:assert/strict";
import { blockIntervals, recentActivity } from "../lib/block-stats.ts";

const block = (height, timestamp, tx_count = 600, weight = 4_000_000) => ({
  height, timestamp, tx_count, weight, size: 1_000_000, id: "a".repeat(64),
});

test("empty and single-block windows do not invent a mining pace or throughput", () => {
  assert.deepEqual(blockIntervals([]), []);
  assert.deepEqual(blockIntervals([block(10, 1000)]), []);
  assert.deepEqual(recentActivity([]), {
    blockCount: 0, fullness: null, averageSeconds: null, transactionsPerSecond: null,
  });
  assert.deepEqual(recentActivity([block(10, 1000)]), {
    blockCount: 1, fullness: 100, averageSeconds: null, transactionsPerSecond: null,
  });
});

test("pace spans N minus one intervals and throughput excludes the oldest anchor", () => {
  const blocks = [block(12, 2200, 1200), block(11, 1600, 600), block(10, 1000, 9000)];
  assert.equal(recentActivity(blocks).averageSeconds, 600);
  assert.equal(recentActivity(blocks).transactionsPerSecond, 1.5);
  assert.deepEqual(blockIntervals(blocks).map((interval) => interval.seconds), [600, 600]);
});

test("equal and backwards block timestamps remain unavailable, not zero-minute bars", () => {
  const blocks = [block(13, 1600), block(12, 1600), block(11, 1700), block(10, 1000)];
  assert.deepEqual(blockIntervals(blocks).map((interval) => interval.seconds), [700, null, null]);
  assert.equal(recentActivity(blocks).averageSeconds, 200);
  assert.equal(recentActivity([block(11, 900), block(10, 1000)]).averageSeconds, null);
  assert.equal(recentActivity([block(11, 900), block(10, 1000)]).transactionsPerSecond, null);
});

test("missing block windows do not imply adjacent-block intervals or throughput", () => {
  const blocks = [block(12, 2200), block(10, 1000)];
  assert.equal(blockIntervals(blocks)[0].seconds, null);
  assert.equal(recentActivity(blocks).averageSeconds, null);
  assert.equal(recentActivity(blocks).transactionsPerSecond, null);
});

test("fullness uses consensus weight capacity and rejects invalid capacities", () => {
  assert.equal(recentActivity([block(11, 1600, 600, 4_000_000), block(10, 1000, 600, 2_000_000)]).fullness, 75);
  assert.equal(recentActivity([block(10, 1000, 600, 4_000_001)]).fullness, null);
  assert.equal(recentActivity([block(11, 1600, -1), block(10, 1000)]).transactionsPerSecond, null);
});
