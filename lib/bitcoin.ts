export const TARGET = 1_000_000;
export type Block = {
  id: string;
  height: number;
  timestamp: number;
  tx_count: number;
  size: number;
  weight: number;
  previousblockhash?: string;
};
export type ChainSnapshot = {
  blocks: Block[];
  source: "mempool.space" | "blockstream.info";
  fetchedAt: number;
  stale?: boolean;
};
export function blocksRemaining(height: number) {
  return Math.max(0, TARGET - height);
}
export function estimateArrival(block: Block) {
  return (block.timestamp + blocksRemaining(block.height) * 600) * 1000;
}
export function validBlocks(value: unknown): value is Block[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= 20 &&
    value.every(
      (b, i) =>
        b &&
        typeof b === "object" &&
        /^[0-9a-f]{64}$/.test(b.id) &&
        Number.isSafeInteger(b.height) &&
        b.height >= 0 &&
        Number.isSafeInteger(b.timestamp) &&
        b.timestamp >= 1231006505 &&
        b.timestamp * 1000 < Date.now() + 7200000 &&
        Number.isSafeInteger(b.tx_count) &&
        b.tx_count > 0 &&
        Number.isSafeInteger(b.size) &&
        b.size > 0 &&
        Number.isSafeInteger(b.weight) &&
        b.weight > 0 &&
        (i === 0 ||
          (value[i - 1].height === b.height + 1 &&
            value[i - 1].previousblockhash === b.id)),
    )
  );
}
export function subsidy(height: number) {
  return (
    Math.floor(5_000_000_000 / 2 ** Math.floor(height / 210_000)) / 100_000_000
  );
}
