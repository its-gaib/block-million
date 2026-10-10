"use client";

import { estimateArrival, TARGET, type ChainSnapshot } from "@/lib/bitcoin";
import {
  BLOCK_MILESTONES,
  MILESTONE_PRICE_SOURCE,
  formatHashrate,
  milestoneBlockSource,
  milestoneHashrateSource,
} from "@/lib/milestones";
import "./block-history.css";

const integer = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const date = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "UTC" });
const dollar = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

function BlockGlyph({ power }: { power: number }) {
  return <svg className="history-block-glyph" viewBox="0 0 80 88" aria-hidden="true">
    <path className="history-block-top" d="M40 5 73 24 40 43 7 24Z" />
    <path className="history-block-left" d="M7 24 40 43 40 82 7 63Z" />
    <path className="history-block-right" d="M40 43 73 24 73 63 40 82Z" />
    <text x="40" y="28" textAnchor="middle">10<tspan dy="-6" fontSize="9">{power}</tspan></text>
    {Array.from({ length: power + 1 }, (_, index) => <path key={index} className="history-block-stripe" d={`M${46 + index * 4} ${47 - index * 2.3}v21`} />)}
  </svg>;
}

export function BlockHistory({ snapshot }: { snapshot: ChainSnapshot | null }) {
  const tip = snapshot?.blocks[0];
  const targetReached = tip && tip.height >= TARGET;
  const estimatedDate = tip && !targetReached ? date.format(estimateArrival(tip)) : null;

  return <section id="block-history" className="block-history-section shell content-section" aria-labelledby="block-history-title">
    <div className="history-heading"><div><p className="history-kicker">1 → 10 → 100 → 1,000 → 10,000 → 100,000</p><h2 id="block-history-title">Bitcoin’s first 100,000 blocks</h2></div><p>Six blocks from Bitcoin’s early history.{" "}<br />Dates, prices and computing power at each step.</p></div>
    <div className="history-milestone-grid">
      {BLOCK_MILESTONES.map((block, index) => <article className="history-milestone-card" key={block.height}>
        <div className="history-milestone-top"><BlockGlyph power={index} /><div><p className="history-block-label">Block height</p><h3><a href={milestoneBlockSource(block)} target="_blank" rel="noreferrer" aria-label={`Open Bitcoin block ${integer.format(block.height)} on mempool.space`}>{integer.format(block.height)}<span aria-hidden="true">↗</span></a></h3></div></div>
        <p className="history-block-date"><time dateTime={new Date(block.timestamp * 1000).toISOString()}>{date.format(block.timestamp * 1000)}<span>{time.format(block.timestamp * 1000)} UTC</span></time></p>
        <dl className="history-milestone-data"><div><dt>BTC price · daily USD</dt><dd className={block.priceUsd === null ? "history-no-price" : "history-price"}>{block.priceUsd === null ? "No exchange price" : <a href={MILESTONE_PRICE_SOURCE} target="_blank" rel="noreferrer">{dollar.format(block.priceUsd)}</a>}</dd></div><div><dt>Hashrate · daily estimate</dt><dd><a href={milestoneHashrateSource(block)} target="_blank" rel="noreferrer">{formatHashrate(block.dailyHashrate)}</a></dd></div><div><dt>Transactions</dt><dd>{integer.format(block.transactions)}</dd></div><div><dt>Size</dt><dd>{integer.format(block.bytes)} <small>bytes</small></dd></div><div><dt>Difficulty</dt><dd>{decimal.format(block.difficulty)}</dd></div><div><dt>Block subsidy</dt><dd>50 <small>BTC</small></dd></div></dl>
        <a className="history-verify-block" href={milestoneBlockSource(block)} target="_blank" rel="noreferrer">Verify block <span aria-hidden="true">↗</span></a>
      </article>)}
    </div>

    <div className="history-next-milestone"><div className="history-next-label"><BlockGlyph power={6} /><div><p>{targetReached ? "Milestone reached" : "Next power of ten"}</p><strong>1,000,000</strong></div></div><div className="history-next-date"><span>{targetReached ? "Block status" : "Estimated arrival · UTC"}</span><strong>{targetReached ? "Mined" : estimatedDate ?? "Waiting for current block"}</strong><p>{targetReached ? "Historical price and hashrate are not recorded here yet." : "Price and hashrate will be known when we get there."}</p></div></div>

    <p className="history-source-note">Block headers and payloads: <a href="https://mempool.space/" target="_blank" rel="noreferrer">mempool.space</a>. Header timestamps are miner-reported. Historical hashrate: <a href="https://www.blockchain.com/explorer/charts/hash-rate" target="_blank" rel="noreferrer">Blockchain.com</a>, estimated over the whole UTC day, not measured at the instant each block was mined. The $0.29 price is the <a href={MILESTONE_PRICE_SOURCE} target="_blank" rel="noreferrer">December 29, 2010 daily average</a>; unavailable early prices are not zero. {snapshot?.stale && "The latest block data is delayed. "}The millionth-height estimate assumes ten minutes per remaining block.</p>
  </section>;
}
