import test from "node:test";
import assert from "node:assert/strict";
import {
  createNetworkLoader,
  sanitizeDifficulty,
  sanitizeMempool,
  sanitizeMining,
} from "../lib/network.ts";

const NOW = 1_791_500_000_000;
const mining = () => ({
  currentHashrate: 987e18,
  currentDifficulty: 132e12,
  hashrates: [
    { timestamp: Math.floor(NOW / 1000) - 86400, avgHashrate: 990e18 },
    { timestamp: Math.floor(NOW / 1000), avgHashrate: 980e18 },
  ],
});
const difficulty = () => ({
  progressPercent: 41.8,
  difficultyChange: 4.14,
  estimatedRetargetDate: NOW + 86400000,
  remainingBlocks: 1172,
  nextRetargetHeight: 971712,
  timeAvg: 576812,
});
const mempool = () => ({ count: 82000, vsize: 42e6 });

test("projects allowlisted fields and correct units, retaining legitimate zeros", () => {
  const raw = mining();
  raw.hashrates[0].untrusted = "<script>";
  const projected = sanitizeMining({ ...raw, source: "attacker.example" }, NOW);
  assert.equal(projected.currentHashrate / 1e18, 987);
  assert.equal(projected.currentDifficulty / 1e12, 132);
  assert.deepEqual(Object.keys(projected), ["hashrates", "currentHashrate", "currentDifficulty"]);
  assert.deepEqual(Object.keys(projected.hashrates[0]), ["timestamp", "avgHashrate"]);
  assert.deepEqual(sanitizeMempool({ count: 0, vsize: 0, total_fee: "bad" }), { count: 0, vsize: 0 });
  const zero = { ...difficulty(), progressPercent: 0, difficultyChange: 0, remainingBlocks: 0 };
  assert.deepEqual(sanitizeDifficulty({ ...zero, unexpected: [] }, NOW), zero);
});

test("rejects malformed, nonfinite, out-of-bounds and wrong-unit upstream values", () => {
  for (const value of [null, [], "bad", 0]) {
    assert.equal(sanitizeMining(value, NOW), null);
    assert.equal(sanitizeDifficulty(value, NOW), null);
    assert.equal(sanitizeMempool(value), null);
  }
  for (const value of [Infinity, NaN, -1, "42", 1e40]) {
    assert.equal(sanitizeMining({ ...mining(), currentHashrate: value }, NOW), null);
    assert.equal(sanitizeMempool({ count: value, vsize: 0 }), null);
  }
  assert.equal(sanitizeMining({ ...mining(), hashrates: [{ timestamp: NOW, avgHashrate: 1 }, mining().hashrates[1]] }, NOW), null);
  assert.equal(sanitizeDifficulty({ ...difficulty(), estimatedRetargetDate: NOW / 1000 }, NOW), null);
  assert.equal(sanitizeDifficulty({ ...difficulty(), difficultyChange: 301 }, NOW), null);
  assert.equal(sanitizeDifficulty({ ...difficulty(), remainingBlocks: 2017 }, NOW), null);
  assert.equal(sanitizeMempool({ count: 1.5, vsize: 1 }), null);
});

test("bounds history size, rejects duplicate dates and orders valid history", () => {
  const raw = mining();
  assert.equal(sanitizeMining({ ...raw, hashrates: Array(63).fill(raw.hashrates[0]) }, NOW), null);
  assert.equal(sanitizeMining({ ...raw, hashrates: [raw.hashrates[0], raw.hashrates[0]] }, NOW), null);
  assert.deepEqual(sanitizeMining({ ...raw, hashrates: [...raw.hashrates].reverse() }, NOW).hashrates, raw.hashrates);
});

function upstream(url) {
  if (url.endsWith("/hashrate/1m")) return mining();
  if (url.endsWith("/difficulty-adjustment")) return difficulty();
  return mempool();
}

test("coalesces requests and independently caches slow-changing mining data", async () => {
  let now = NOW;
  const calls = [];
  const load = createNetworkLoader({
    now: () => now,
    fetch: async (url, options) => {
      calls.push(url);
      assert.equal(options.redirect, "manual");
      assert.deepEqual(options.headers, { Accept: "application/json" });
      assert.ok(options.signal instanceof AbortSignal);
      return Response.json(upstream(url));
    },
  });
  const [first, second] = await Promise.all([load(), load()]);
  assert.deepEqual(first, second);
  assert.equal(calls.length, 3);
  assert.equal(first.mining.fetchedAt, NOW);
  assert.equal(first.mining.stale, false);
  now += 60001;
  await load();
  assert.equal(calls.length, 5);
  assert.equal(calls.filter((url) => url.includes("hashrate")).length, 1);
});

test("keeps partial success and retries failures only after cooldown", async () => {
  let now = NOW;
  let fail = true;
  const calls = [];
  const load = createNetworkLoader({
    now: () => now,
    fetch: async (url) => {
      calls.push(url);
      if (fail && url.includes("hashrate")) throw new Error("provider unavailable");
      if (url === "https://mempool.space/api/mempool") return new Response("", { status: 503 });
      return Response.json(upstream(url));
    },
  });
  const first = await load();
  assert.equal(first.mining, null);
  assert.equal(first.mempool.source, "blockstream.info");
  assert.ok(first.difficulty);
  const count = calls.length;
  await load();
  assert.equal(calls.length, count);
  now += 30001;
  fail = false;
  assert.ok((await load()).mining);
  assert.equal(calls.length, count + 1);
});

test("failed refresh preserves observation time and marks only old resources stale", async () => {
  let now = NOW;
  let fail = false;
  const load = createNetworkLoader({
    now: () => now,
    fetch: async (url) => {
      if (fail) throw new Error("offline");
      return Response.json(upstream(url));
    },
  });
  await load();
  now += 60001;
  fail = true;
  const result = await load();
  assert.equal(result.mining.stale, false);
  assert.equal(result.mempool.stale, true);
  assert.equal(result.difficulty.stale, true);
  assert.equal(result.mempool.fetchedAt, NOW);
  assert.equal(result.difficulty.fetchedAt, NOW);
});

test("rejects streamed oversized bodies and redirects without fetching their destinations", async () => {
  const urls = [];
  let canceled = false;
  const load = createNetworkLoader({
    now: () => NOW,
    fetch: async (url) => {
      urls.push(url);
      if (url.includes("hashrate")) {
        return new Response(new ReadableStream({
          start(controller) { controller.enqueue(new Uint8Array(65537)); },
          cancel() { canceled = true; },
        }));
      }
      return new Response(null, { status: 302, headers: { Location: "http://127.0.0.1/secret" } });
    },
  });
  assert.deepEqual(await load(), { mining: null, difficulty: null, mempool: null });
  assert.ok(canceled);
  assert.equal(urls.length, 4);
  assert.ok(urls.every((url) => url.startsWith("https://mempool.space/") || url.startsWith("https://blockstream.info/")));
});
