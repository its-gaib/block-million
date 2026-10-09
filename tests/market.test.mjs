import test from "node:test";
import assert from "node:assert/strict";
import { createMarketLoader, dailyPriceComparison, GENESIS_TIME, nearestPriceIndex, samplePricePoints, sanitizeCoinbasePrice, sanitizeMempoolPrice, sanitizePriceHistory, selectPriceRange } from "../lib/market.ts";

const NOW = 1_791_550_000_000;
const TODAY = Math.floor(NOW / 86400000) * 86400;
const history = () => ({ status: "ok", values: [{ x: 1230940800, y: 0 }, { x: TODAY - 86400 * 2, y: 80000 }, { x: TODAY - 86400, y: 82000 }] });
const spot = () => ({ time: Math.floor(NOW / 1000), USD: 83000, EUR: 72000 });
const coinbase = () => ({ price: "83100.12", time: new Date(NOW).toISOString(), untrusted: "ignored" });

test("price history removes absent early prices and projects only numeric fields", () => {
  const raw = history();
  raw.values[1].untrusted = "<script>";
  assert.deepEqual(sanitizePriceHistory(raw, NOW), [{ timestamp: TODAY - 172800, usd: 80000 }, { timestamp: TODAY - 86400, usd: 82000 }]);
  assert.deepEqual(sanitizePriceHistory({ ...raw, values: raw.values.toReversed() }, NOW), sanitizePriceHistory(raw, NOW));
  assert.deepEqual(sanitizeMempoolPrice(spot(), NOW), { usd: 83000, observedAt: Math.floor(NOW / 1000) });
  assert.deepEqual(sanitizeCoinbasePrice(coinbase(), NOW), { usd: 83100.12, observedAt: Math.floor(NOW / 1000) });
});

test("rejects duplicate, excessive, nonfinite, negative and future price history", () => {
  for (const raw of [null, [], "bad", { status: "error", values: history().values }, { status: "ok", values: Array(10001).fill(history().values[0]) }, { status: "ok", values: [history().values[1], history().values[1]] }]) assert.equal(sanitizePriceHistory(raw, NOW), null);
  for (const y of [NaN, Infinity, -1, "7", 1e13]) assert.equal(sanitizePriceHistory({ status: "ok", values: [{ x: TODAY, y }, history().values[1]] }, NOW), null);
  for (const x of [NOW, Math.floor(NOW / 1000) + 301, GENESIS_TIME - 1e7, 1.5]) assert.equal(sanitizePriceHistory({ status: "ok", values: [{ x, y: 5 }, history().values[1]] }, NOW), null);
  assert.equal(sanitizePriceHistory({ status: "ok", values: [{ x: TODAY, y: 0 }, history().values[1]] }, NOW), null);
});

test("rejects invalid quotes and preserves observation times", () => {
  for (const USD of [0, -1, NaN, Infinity, "83000"]) assert.equal(sanitizeMempoolPrice({ ...spot(), USD }, NOW), null);
  assert.equal(sanitizeMempoolPrice({ ...spot(), time: NOW }, NOW), null);
  for (const price of ["0", "-1", "1e8", "Infinity", " 12", "12 ", 12, "9000000000000"]) assert.equal(sanitizeCoinbasePrice({ ...coinbase(), price }, NOW), null);
  assert.equal(sanitizeCoinbasePrice({ ...coinbase(), time: "bad" }, NOW), null);
  assert.equal(sanitizeCoinbasePrice({ ...coinbase(), time: new Date(NOW + 301000).toISOString() }, NOW), null);
});

function upstream(url) { return url.includes("charts") ? history() : url.includes("coinbase") ? coinbase() : spot(); }

test("coalesces requests while history and quotes retain independent cache lifetimes", async () => {
  let now = NOW;
  const calls = [];
  const load = createMarketLoader({ now: () => now, fetch: async (url, options) => {
    calls.push(url);
    assert.equal(options.redirect, "manual");
    assert.ok(options.signal instanceof AbortSignal);
    assert.deepEqual(options.headers, { Accept: "application/json" });
    return Response.json(upstream(url));
  } });
  const [first, second] = await Promise.all([load(), load()]);
  assert.deepEqual(first, second);
  assert.equal(calls.length, 2);
  assert.equal(first.spot.observedAt, spot().time);
  assert.equal(first.history.observedAt, TODAY - 86400);
  now += 60001;
  await load();
  assert.equal(calls.length, 3);
  assert.equal(calls.filter((url) => url.includes("charts")).length, 1);
});

test("quote fallback and failure cooldown preserve successful history", async () => {
  let now = NOW;
  let fail = false;
  const calls = [];
  const load = createMarketLoader({ now: () => now, fetch: async (url) => {
    calls.push(url);
    if (url.includes("mempool") || (fail && url.includes("coinbase"))) throw new Error("offline");
    return Response.json(upstream(url));
  } });
  const first = await load();
  assert.equal(first.spot.source, "coinbase.com");
  now += 60001;
  fail = true;
  const old = await load();
  assert.equal(old.spot.stale, true);
  assert.equal(old.spot.fetchedAt, NOW);
  assert.equal(old.spot.observedAt, first.spot.observedAt);
  assert.equal(old.history.stale, false);
  const count = calls.length;
  await load();
  assert.equal(calls.length, count);
  now += 30001;
  await load();
  assert.equal(calls.length, count + 2);
});

test("old primary quotes fall back and old daily observations are explicitly stale", async () => {
  const load = createMarketLoader({ now: () => NOW, fetch: async (url) => {
    if (url.includes("mempool")) return Response.json({ ...spot(), time: spot().time - 301 });
    if (url.includes("charts")) return Response.json({ status: "ok", values: [{ x: TODAY - 5 * 86400, y: 7 }, { x: TODAY - 4 * 86400, y: 9 }] });
    return Response.json(coinbase());
  } });
  const result = await load();
  assert.equal(result.spot.source, "coinbase.com");
  assert.equal(result.history.stale, true);
  assert.equal(result.history.fetchedAt, NOW);
});

test("oversized streams are cancelled and redirects never contact their targets", async () => {
  const calls = [];
  let cancelled = false;
  const load = createMarketLoader({ now: () => NOW, fetch: async (url) => {
    calls.push(url);
    if (url.includes("charts")) return new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(524289)); }, cancel() { cancelled = true; } }));
    return new Response(null, { status: 302, headers: { Location: "http://127.0.0.1/private" } });
  } });
  assert.deepEqual(await load(), { history: null, spot: null });
  assert.ok(cancelled);
  assert.equal(calls.length, 3);
  assert.ok(calls.every((url) => ["api.blockchain.info", "mempool.space", "api.exchange.coinbase.com"].includes(new URL(url).hostname)));
});

test("daily comparison labels a recent completed reference, never a partial day or old datum", () => {
  const points = [{ timestamp: TODAY - 86400, usd: 100 }, { timestamp: TODAY, usd: 105 }];
  const result = dailyPriceComparison(points, { observedAt: TODAY + 3600, usd: 110 });
  assert.equal(result.point.timestamp, TODAY - 86400);
  assert.ok(Math.abs(result.percent - 10) < 1e-10);
  assert.equal(dailyPriceComparison(points, { observedAt: TODAY + 4 * 86400, usd: 110 }), null);
  assert.equal(dailyPriceComparison(points, null), null);
});

test("range selection and rendering sample preserve real observations and extremes", () => {
  const points = Array.from({ length: 6000 }, (_, index) => ({ timestamp: GENESIS_TIME + (index + 1) * 86400, usd: index === 2999 ? 1e8 : index === 3000 ? 0.01 : index + 1 }));
  assert.equal(selectPriceRange(points, "30D").length, 30);
  assert.equal(selectPriceRange(points, "1Y").length, 365);
  assert.equal(selectPriceRange(points, "All").length, 6000);
  const sampled = samplePricePoints(points);
  assert.ok(sampled.length <= 400);
  assert.equal(sampled[0], points[0]);
  assert.equal(sampled.at(-1), points.at(-1));
  assert.ok(sampled.includes(points[2999]));
  assert.ok(sampled.includes(points[3000]));
  assert.ok(sampled.every((point, index) => index === 0 || point.timestamp > sampled[index - 1].timestamp));
  assert.equal(nearestPriceIndex(points, points[2333].timestamp + 1), 2333);
  assert.equal(nearestPriceIndex(points, 0), 0);
  assert.equal(nearestPriceIndex(points, NOW * 10), 5999);
  assert.equal(nearestPriceIndex([], NOW), -1);
});
