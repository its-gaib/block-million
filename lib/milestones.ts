/** Selected block headers, verified against the linked mempool.space blocks. */
export type BlockMilestone = {
  height: number;
  hash: string;
  timestamp: number;
  transactions: number;
  bytes: number;
  difficulty: number;
  /** USD daily average; null means no exchange price is available for that date. */
  priceUsd: number | null;
  /** Blockchain.com daily network estimate, in hashes per second. */
  dailyHashrate: number;
};

export const GENESIS_TIMESTAMP = 1_231_006_505;
export const MILESTONE_PRICE_SOURCE =
  "https://api.blockchain.info/charts/market-price?start=2010-12-29&timespan=2days&format=json";

export const BLOCK_MILESTONES: readonly BlockMilestone[] = [
  { height: 1, hash: "00000000839a8e6886ab5951d76f411475428afc90947ee320161bbf18eb6048", timestamp: 1231469665, transactions: 1, bytes: 215, difficulty: 1, priceUsd: null, dailyHashrate: 695943.774814815 },
  { height: 10, hash: "000000002c05cc2e78923c34df87fd108b22221ac6076c18f3ade378a4d915e9", timestamp: 1231473952, transactions: 1, bytes: 215, difficulty: 1, priceUsd: null, dailyHashrate: 695943.774814815 },
  { height: 100, hash: "000000007bc154e0fa7ea32218a72fe2c1bb9f86cf8c9ebf9a715ed27fdb229a", timestamp: 1231660825, transactions: 1, bytes: 215, difficulty: 1, priceUsd: null, dailyHashrate: 5269288.58074074 },
  { height: 1000, hash: "00000000c937983704a73af28acdec37b049d214adbda81d7e2a3dd146f6ed09", timestamp: 1232346882, transactions: 1, bytes: 216, difficulty: 1, priceUsd: null, dailyHashrate: 5915522.08592593 },
  { height: 10000, hash: "0000000099c744455f58e6c6e98b671e1bf7f37346bfd4cf5d0274ad8ee660cb", timestamp: 1238988213, transactions: 1, bytes: 216, difficulty: 1, priceUsd: null, dailyHashrate: 5716681.00740741 },
  { height: 100000, hash: "000000000003ba27aa200b1cecaad478d2b00432346c3f1f3986da1afd33e506", timestamp: 1293623863, transactions: 4, bytes: 957, difficulty: 14484.162361225399, priceUsd: 0.29, dailyHashrate: 123841998009.766 },
];

export function milestoneBlockSource(milestone: BlockMilestone): string {
  return `https://mempool.space/block/${milestone.hash}`;
}

export function milestoneHashrateSource(milestone: BlockMilestone): string {
  const date = new Date(milestone.timestamp * 1000).toISOString().slice(0, 10);
  return `https://api.blockchain.info/charts/hash-rate?start=${date}&timespan=1days&format=json`;
}

export function formatHashrate(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value < 0) return "Unavailable";
  const units = ["H/s", "kH/s", "MH/s", "GH/s", "TH/s", "PH/s", "EH/s", "ZH/s"];
  const exponent = Math.min(units.length - 1, Math.max(0, Math.floor(Math.log10(value || 1) / 3)));
  const amount = value / 1000 ** exponent;
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: amount < 10 ? 2 : 1 }).format(amount)} ${units[exponent]}`;
}
