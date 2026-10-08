export type NetworkSource = "mempool.space" | "blockstream.info";

export type NetworkResource<T> = {
  data: T;
  /** Time of the successful fetch, in Unix milliseconds. */
  fetchedAt: number;
  stale: boolean;
  source: NetworkSource;
};

export type MiningData = {
  /** Daily estimates: Unix seconds and hashes per second. */
  hashrates: Array<{ timestamp: number; avgHashrate: number }>;
  currentHashrate: number;
  currentDifficulty: number;
};

export type DifficultyData = {
  progressPercent: number;
  difficultyChange: number;
  /** Unix milliseconds. */
  estimatedRetargetDate: number;
  remainingBlocks: number;
  nextRetargetHeight: number;
  /** Average block interval in milliseconds. */
  timeAvg: number;
};

export type MempoolData = {
  count: number;
  /** Virtual bytes. */
  vsize: number;
};

export type NetworkSnapshot = {
  mining: NetworkResource<MiningData> | null;
  difficulty: NetworkResource<DifficultyData> | null;
  mempool: NetworkResource<MempoolData> | null;
};

const DAY = 86_400_000;
const GENESIS_SECONDS = 1_231_006_505;
const MAX_RESPONSE_BYTES = 65_536;
const FAILURE_COOLDOWN_MS = 30_000;

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function numberInRange(
  value: unknown,
  minimum: number,
  maximum: number,
): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= minimum &&
    value <= maximum
  );
}

function integerInRange(
  value: unknown,
  minimum: number,
  maximum: number,
): value is number {
  return numberInRange(value, minimum, maximum) && Number.isInteger(value);
}

/** Project only validated fields; never send provider objects to the browser. */
export function sanitizeMining(
  value: unknown,
  now = Date.now(),
): MiningData | null {
  if (
    !record(value) ||
    !numberInRange(value.currentHashrate, 1, 1e30) ||
    !numberInRange(value.currentDifficulty, 1, 1e24) ||
    !Array.isArray(value.hashrates) ||
    value.hashrates.length < 2 ||
    value.hashrates.length > 62
  )
    return null;

  const hashrates: MiningData["hashrates"] = [];
  for (const point of value.hashrates) {
    if (
      !record(point) ||
      !integerInRange(
        point.timestamp,
        GENESIS_SECONDS,
        Math.floor((now + DAY) / 1000),
      ) ||
      !numberInRange(point.avgHashrate, 0, 1e30)
    )
      return null;
    hashrates.push({
      timestamp: point.timestamp,
      avgHashrate: point.avgHashrate,
    });
  }
  hashrates.sort((a, b) => a.timestamp - b.timestamp);
  if (
    hashrates.some(
      (point, index) => index > 0 && point.timestamp === hashrates[index - 1].timestamp,
    )
  )
    return null;

  return {
    hashrates,
    currentHashrate: value.currentHashrate,
    currentDifficulty: value.currentDifficulty,
  };
}

export function sanitizeDifficulty(
  value: unknown,
  now = Date.now(),
): DifficultyData | null {
  if (
    !record(value) ||
    !numberInRange(value.progressPercent, 0, 100) ||
    !numberInRange(value.difficultyChange, -75, 300) ||
    !integerInRange(value.estimatedRetargetDate, now - DAY, now + 366 * DAY) ||
    !integerInRange(value.remainingBlocks, 0, 2016) ||
    !integerInRange(value.nextRetargetHeight, 2016, 100_000_000) ||
    !numberInRange(value.timeAvg, 1, DAY)
  )
    return null;
  return {
    progressPercent: value.progressPercent,
    difficultyChange: value.difficultyChange,
    estimatedRetargetDate: value.estimatedRetargetDate,
    remainingBlocks: value.remainingBlocks,
    nextRetargetHeight: value.nextRetargetHeight,
    timeAvg: value.timeAvg,
  };
}

export function sanitizeMempool(value: unknown): MempoolData | null {
  if (
    !record(value) ||
    !integerInRange(value.count, 0, 100_000_000) ||
    !integerInRange(value.vsize, 0, 1_000_000_000_000)
  )
    return null;
  return { count: value.count, vsize: value.vsize };
}

type Provider = { source: NetworkSource; url: string };
type ResourceCache<T> = {
  value: NetworkResource<T> | null;
  pending: Promise<NetworkResource<T> | null> | null;
  retryAfter: number;
};
type Fetch = typeof globalThis.fetch;

async function readBoundedJson(url: string, request: Fetch): Promise<unknown> {
  const response = await request(url, {
    signal: AbortSignal.timeout(6500),
    redirect: "manual",
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (
    !response.ok ||
    Number(response.headers.get("content-length")) > MAX_RESPONSE_BYTES
  ) {
    await response.body?.cancel();
    throw new Error("Network data response unavailable");
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Network data response is empty");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error("Network data response exceeds size limit");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

/** Each instance owns fixed upstream URLs and independent resource caches. */
export function createNetworkLoader(
  options: { fetch?: Fetch; now?: () => number } = {},
): () => Promise<NetworkSnapshot> {
  const request = options.fetch ?? globalThis.fetch;
  const now = options.now ?? Date.now;

  function resource<T>(
    providers: readonly Provider[],
    ttl: number,
    sanitize: (value: unknown, fetchedAt: number) => T | null,
  ): () => Promise<NetworkResource<T> | null> {
    const cache: ResourceCache<T> = { value: null, pending: null, retryAfter: 0 };
    const previous = (): NetworkResource<T> | null =>
      cache.value ? { ...cache.value, stale: true } : null;

    async function refresh(): Promise<NetworkResource<T> | null> {
      for (const provider of providers) {
        try {
          const raw = await readBoundedJson(provider.url, request);
          const fetchedAt = now();
          const data = sanitize(raw, fetchedAt);
          if (data === null) continue;
          cache.value = { data, fetchedAt, stale: false, source: provider.source };
          cache.retryAfter = 0;
          return cache.value;
        } catch {
          // Independent resources and the second mempool provider can still succeed.
        }
      }
      cache.retryAfter = now() + FAILURE_COOLDOWN_MS;
      return previous();
    }

    return async () => {
      if (cache.value && now() - cache.value.fetchedAt < ttl) return cache.value;
      if (cache.pending) return cache.pending;
      if (now() < cache.retryAfter) return previous();
      cache.pending = refresh().finally(() => {
        cache.pending = null;
      });
      return cache.pending;
    };
  }

  const mining = resource<MiningData>(
    [{ source: "mempool.space", url: "https://mempool.space/api/v1/mining/hashrate/1m" }],
    600_000,
    sanitizeMining,
  );
  const difficulty = resource<DifficultyData>(
    [{ source: "mempool.space", url: "https://mempool.space/api/v1/difficulty-adjustment" }],
    60_000,
    sanitizeDifficulty,
  );
  const mempool = resource<MempoolData>(
    [
      { source: "mempool.space", url: "https://mempool.space/api/mempool" },
      { source: "blockstream.info", url: "https://blockstream.info/api/mempool" },
    ],
    60_000,
    sanitizeMempool,
  );

  return async () => {
    const [miningResult, difficultyResult, mempoolResult] = await Promise.all([
      mining(),
      difficulty(),
      mempool(),
    ]);
    return {
      mining: miningResult,
      difficulty: difficultyResult,
      mempool: mempoolResult,
    };
  };
}

export const loadNetworkSnapshot = createNetworkLoader();
