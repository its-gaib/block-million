export type PricePoint = { timestamp: number; usd: number };
export type MarketSource = "blockchain.info" | "mempool.space" | "coinbase.com";
export type MarketResource<T> = {
  data: T;
  /** Successful fetch time, in Unix milliseconds. */
  fetchedAt: number;
  /** Actual provider observation time, in Unix seconds. */
  observedAt: number;
  stale: boolean;
  source: MarketSource;
};
export type MarketSnapshot = {
  history: MarketResource<{ points: PricePoint[] }> | null;
  spot: MarketResource<{ usd: number }> | null;
};
export type PriceRange = "30D" | "1Y" | "All";
export type PriceScale = "linear" | "log" | "loglog";
export const GENESIS_TIME = 1_231_006_505;
const FIRST_DAY = 1_230_940_800;
const DAY = 86_400;
const MAX_BYTES = 524_288;
const MAX_POINTS = 10_000;
const FAILURE_COOLDOWN = 30_000;

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function finite(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= minimum && value <= maximum;
}
function timestamp(value: unknown, now: number): value is number {
  return finite(value, FIRST_DAY, Math.floor(now / 1000) + 300) && Number.isSafeInteger(value);
}

/** Zero values in this provider's early history mean no price, not free Bitcoin. */
export function sanitizePriceHistory(value: unknown, now = Date.now()): PricePoint[] | null {
  if (!record(value) || value.status !== "ok" || !Array.isArray(value.values) || value.values.length < 2 || value.values.length > MAX_POINTS) return null;
  const seen = new Set<number>();
  const points: PricePoint[] = [];
  for (const point of value.values) {
    if (!record(point) || !timestamp(point.x, now) || !finite(point.y, 0, 1e12) || seen.has(point.x)) return null;
    seen.add(point.x);
    if (point.y > 0 && point.x > GENESIS_TIME) points.push({ timestamp: point.x, usd: point.y });
  }
  return points.length >= 2 ? points.sort((a, b) => a.timestamp - b.timestamp) : null;
}

export function sanitizeMempoolPrice(value: unknown, now = Date.now()): { usd: number; observedAt: number } | null {
  if (!record(value) || !timestamp(value.time, now) || !finite(value.USD, Number.MIN_VALUE, 1e12)) return null;
  return { usd: value.USD, observedAt: value.time };
}

export function sanitizeCoinbasePrice(value: unknown, now = Date.now()): { usd: number; observedAt: number } | null {
  if (!record(value) || typeof value.price !== "string" || !/^\d{1,13}(?:\.\d{1,12})?$/.test(value.price) || typeof value.time !== "string" || value.time.length > 40) return null;
  const usd = Number(value.price);
  const observedAt = Math.floor(Date.parse(value.time) / 1000);
  if (!finite(usd, Number.MIN_VALUE, 1e12) || !timestamp(observedAt, now)) return null;
  return { usd, observedAt };
}

type Fetch = typeof globalThis.fetch;
async function readJson(url: string, request: Fetch): Promise<unknown> {
  const response = await request(url, { signal: AbortSignal.timeout(6500), redirect: "manual", cache: "no-store", headers: { Accept: "application/json" } });
  if (!response.ok || Number(response.headers.get("content-length")) > MAX_BYTES) {
    await response.body?.cancel();
    throw new Error("Market response unavailable");
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Empty market response");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) {
        await reader.cancel();
        throw new Error("Market response exceeds limit");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder().decode(bytes));
}

type Parsed<T> = { data: T; observedAt: number };
type Provider<T> = { url: string; source: MarketSource; parse: (raw: unknown, now: number) => Parsed<T> | null };

export function createMarketLoader(options: { fetch?: Fetch; now?: () => number } = {}): () => Promise<MarketSnapshot> {
  const request = options.fetch ?? globalThis.fetch;
  const now = options.now ?? Date.now;
  function resource<T>(providers: readonly Provider<T>[], ttl: number, maximumAge: number) {
    let value: MarketResource<T> | null = null;
    let pending: Promise<MarketResource<T> | null> | null = null;
    let retryAfter = 0;
    const result = (failed = false): MarketResource<T> | null => value ? { ...value, stale: failed || now() - value.observedAt * 1000 > maximumAge } : null;
    async function refresh(): Promise<MarketResource<T> | null> {
      for (const provider of providers) {
        try {
          const raw = await readJson(provider.url, request);
          const fetchedAt = now();
          const parsed = provider.parse(raw, fetchedAt);
          if (!parsed || (value && parsed.observedAt < value.observedAt)) continue;
          // A stale primary quote must not prevent trying the independent fallback.
          if (fetchedAt - parsed.observedAt * 1000 > maximumAge && providers.length > 1) continue;
          value = { ...parsed, fetchedAt, source: provider.source, stale: false };
          retryAfter = 0;
          return result();
        } catch {
          // A missing feed never blocks independent market or countdown data.
        }
      }
      retryAfter = now() + FAILURE_COOLDOWN;
      return result(true);
    }
    return async () => {
      if (pending) return pending;
      if (now() < retryAfter) return result(true);
      if (value && now() - value.fetchedAt < ttl) return result();
      pending = refresh().finally(() => { pending = null; });
      return pending;
    };
  }
  const history = resource<{ points: PricePoint[] }>([{
    url: "https://api.blockchain.info/charts/market-price?timespan=all&format=json&sampled=false",
    source: "blockchain.info",
    parse: (raw, fetchedAt) => {
      const points = sanitizePriceHistory(raw, fetchedAt);
      return points ? { data: { points }, observedAt: points[points.length - 1].timestamp } : null;
    },
  }], 6 * 60 * 60 * 1000, 3 * DAY * 1000);
  const spot = resource<{ usd: number }>([
    { url: "https://mempool.space/api/v1/prices", source: "mempool.space", parse: (raw, fetchedAt) => { const quote = sanitizeMempoolPrice(raw, fetchedAt); return quote ? { data: { usd: quote.usd }, observedAt: quote.observedAt } : null; } },
    { url: "https://api.exchange.coinbase.com/products/BTC-USD/ticker", source: "coinbase.com", parse: (raw, fetchedAt) => { const quote = sanitizeCoinbasePrice(raw, fetchedAt); return quote ? { data: { usd: quote.usd }, observedAt: quote.observedAt } : null; } },
  ], 60_000, 5 * 60_000);
  return async () => { const [historyResult, spotResult] = await Promise.all([history(), spot()]); return { history: historyResult, spot: spotResult }; };
}
export const loadMarketSnapshot = createMarketLoader();

export function selectPriceRange(points: readonly PricePoint[], range: PriceRange): PricePoint[] {
  const last = points.at(-1);
  if (!last || range === "All") return [...points];
  const from = last.timestamp - (range === "30D" ? 29 : 364) * DAY;
  return points.filter((point) => point.timestamp >= from);
}

/** Keep local peaks/troughs and endpoints while bounding the SVG path size. */
export function samplePricePoints(points: readonly PricePoint[], limit = 400): PricePoint[] {
  if (points.length <= limit) return [...points];
  const buckets = Math.max(1, Math.floor((limit - 2) / 2));
  const sampled: PricePoint[] = [points[0]];
  for (let bucket = 0; bucket < buckets; bucket++) {
    const start = 1 + Math.floor(bucket * (points.length - 2) / buckets);
    const end = 1 + Math.floor((bucket + 1) * (points.length - 2) / buckets);
    let low = start;
    let high = start;
    for (let index = start + 1; index < end; index++) {
      if (points[index].usd < points[low].usd) low = index;
      if (points[index].usd > points[high].usd) high = index;
    }
    for (const index of [...new Set([low, high])].sort((a, b) => a - b)) sampled.push(points[index]);
  }
  sampled.push(points[points.length - 1]);
  return sampled;
}

export function nearestPriceIndex(points: readonly PricePoint[], time: number): number {
  if (!points.length) return -1;
  let low = 0;
  let high = points.length - 1;
  while (low < high) { const middle = Math.floor((low + high) / 2); if (points[middle].timestamp < time) low = middle + 1; else high = middle; }
  return low > 0 && Math.abs(points[low - 1].timestamp - time) <= Math.abs(points[low].timestamp - time) ? low - 1 : low;
}

/** A daily reference is explicitly distinct from a rolling 24-hour quote change. */
export function dailyPriceComparison(points: readonly PricePoint[], quote: { usd: number; observedAt: number } | null): { point: PricePoint; percent: number } | null {
  if (!quote) return null;
  const startOfDay = Math.floor(quote.observedAt / DAY) * DAY;
  const point = points.findLast((candidate) => candidate.timestamp < startOfDay);
  if (!point || quote.observedAt - point.timestamp > 3 * DAY) return null;
  return { point, percent: (quote.usd / point.usd - 1) * 100 };
}
