/** Bitcoin mainnet subsidy schedule, including the height-zero genesis subsidy. */
export const HALVING_INTERVAL = 210_000;
export const SATOSHIS_PER_BITCOIN = 100_000_000;

function validHeight(height: number) {
  if (!Number.isSafeInteger(height) || height < 0) {
    throw new RangeError("Block height must be a non-negative safe integer");
  }
}

export function blockSubsidySatoshis(height: number): number {
  validHeight(height);
  const era = Math.floor(height / HALVING_INTERVAL);
  // The reward reaches zero after 33 halvings. Avoid JavaScript's 32-bit shifts.
  return era >= 33 ? 0 : Math.floor(5_000_000_000 / 2 ** era);
}

/** Sum the scheduled subsidies from height 0 through height, inclusive.
 * This is not circulating supply: it includes genesis and unclaimed subsidies.
 * All arithmetic stays in integer satoshis, below Number.MAX_SAFE_INTEGER.
 */
export function scheduledIssuedSatoshis(height: number): number {
  validHeight(height);
  let total = 0;
  for (let era = 0; era < 33; era++) {
    const start = era * HALVING_INTERVAL;
    if (height < start) break;
    const blocks = Math.min(HALVING_INTERVAL, height - start + 1);
    total += blocks * Math.floor(5_000_000_000 / 2 ** era);
  }
  return total;
}
