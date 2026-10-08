import type { Block } from "./bitcoin";

export type BlockInterval = {
  height: number;
  timestamp: number;
  seconds: number | null;
};

/** Block timestamps can move backwards; an invalid interval stays missing. */
export function blockIntervals(blocks: Block[]): BlockInterval[] {
  return blocks.slice(0, -1).map((block, index) => {
    const previous = blocks[index + 1];
    const difference = block.timestamp - previous.timestamp;
    return {
      height: block.height,
      timestamp: block.timestamp,
      seconds:
        block.height === previous.height + 1 &&
        Number.isFinite(difference) &&
        difference > 0
          ? difference
          : null,
    };
  }).reverse();
}

/** The oldest block anchors the window, so its transactions precede it. */
export function recentActivity(blocks: Block[]) {
  const blockCount = blocks.length;
  const weights = blocks.map((block) => block.weight);
  const fullness = blockCount > 0 && weights.every(
    (weight) => Number.isFinite(weight) && weight >= 0 && weight <= 4_000_000,
  )
    ? weights.reduce((total, weight) => total + weight, 0) / blockCount / 40_000
    : null;
  const newest = blocks[0];
  const oldest = blocks[blockCount - 1];
  const elapsed = newest && oldest ? newest.timestamp - oldest.timestamp : 0;
  const consecutive = blocks.every(
    (block, index) => index === 0 || blocks[index - 1].height === block.height + 1,
  );
  const usableWindow = blockCount > 1 && consecutive && Number.isFinite(elapsed) && elapsed > 0;
  const transactions = blocks.slice(0, -1).map((block) => block.tx_count);
  const validTransactions = transactions.every(
    (count) => Number.isSafeInteger(count) && count >= 0,
  );
  return {
    blockCount,
    fullness,
    averageSeconds: usableWindow ? elapsed / (blockCount - 1) : null,
    transactionsPerSecond: usableWindow && validTransactions
      ? transactions.reduce((total, count) => total + count, 0) / elapsed
      : null,
  };
}
