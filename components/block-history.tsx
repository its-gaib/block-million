"use client";

import { useId, useState } from "react";
import { estimateArrival, TARGET, type ChainSnapshot } from "@/lib/bitcoin";
import type { NetworkSnapshot } from "@/lib/network";
import {
  BLOCK_MILESTONES,
  MILESTONE_PRICE_SOURCE,
  chartFraction,
  daysSinceGenesis,
  formatHashrate,
  linearChartMaximum,
  milestoneBlockSource,
  milestoneHashrateSource,
  type ScaleMode,
} from "@/lib/milestones";
import "./block-history.css";

const integer = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const date = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "UTC" });
const dollar = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

type HistoryPoint = {
  height: number;
  value: number;
  timestamp: number;
  current?: boolean;
};
type PayloadPoint = {
  height: number;
  timestamp: number;
  transactions: number;
  bytes: number;
  current?: boolean;
};

function heightLabel(point: { height: number; current?: boolean }) {
  return `${point.current ? "Latest block · " : "Block "}${integer.format(point.height)}`;
}

function BlockGlyph({ power }: { power: number }) {
  return <svg className="history-block-glyph" viewBox="0 0 80 88" aria-hidden="true">
    <path className="history-block-top" d="M40 5 73 24 40 43 7 24Z" />
    <path className="history-block-left" d="M7 24 40 43 40 82 7 63Z" />
    <path className="history-block-right" d="M40 43 73 24 73 63 40 82Z" />
    <text x="40" y="28" textAnchor="middle">10<tspan dy="-6" fontSize="9">{power}</tspan></text>
    {Array.from({ length: power + 1 }, (_, index) => <path key={index} className="history-block-stripe" d={`M${46 + index * 4} ${47 - index * 2.3}v21`} />)}
  </svg>;
}

function PointChoices({ points, selected, select }: {
  points: HistoryPoint[];
  selected: number;
  select: (height: number) => void;
}) {
  return <div className="history-point-choices" aria-label="Select a block to inspect">
    {points.map((point) => <button key={point.height} type="button" className={point.height === selected ? "selected" : ""} aria-pressed={point.height === selected} onClick={() => select(point.height)}>
      {point.current ? "Latest" : compact.format(point.height)}
    </button>)}
  </div>;
}

function ScaleControl({ mode, setMode, label }: { mode: ScaleMode; setMode: (value: ScaleMode) => void; label: string }) {
  return <div className="history-chart-toggle" role="group" aria-label={`${label} scales`}>
    <button type="button" aria-pressed={mode === "log"} onClick={() => setMode("log")}>Log–log</button>
    <button type="button" aria-pressed={mode === "linear"} onClick={() => setMode("linear")}>Linear</button>
  </div>;
}

function MilestoneChart({ title, subtitle, points, yLabel, format, hash = false }: {
  title: string;
  subtitle: string;
  points: HistoryPoint[];
  yLabel: string;
  format: (value: number) => string;
  hash?: boolean;
}) {
  const [mode, setMode] = useState<ScaleMode>("log");
  const [selectedHeight, setSelectedHeight] = useState<number | null>(null);
  const id = useId().replaceAll(":", "");
  const selected = points.find((point) => point.height === selectedHeight) ?? points.at(-1)!;
  const maximumHeight = Math.max(TARGET, ...points.map((point) => point.height));
  const xMaximum = 10 ** Math.ceil(Math.log10(maximumHeight));
  const maximum = Math.max(...points.map((point) => point.value));
  const yMinimum = mode === "linear" ? 0 : hash ? 1e5 : 1;
  const yMaximum = mode === "linear" ? linearChartMaximum(maximum) : 10 ** Math.ceil(Math.log10(maximum));
  const xMinimum = mode === "linear" ? 0 : 1;
  const x = (value: number) => 73 + (chartFraction(value, xMinimum, xMaximum, mode) ?? 0) * 487;
  const y = (value: number) => 227 - (chartFraction(value, yMinimum, yMaximum, mode) ?? 0) * 183;
  const xTicks = mode === "log" ? Array.from({ length: Math.log10(xMaximum) + 1 }, (_, index) => 10 ** index) : [0, xMaximum / 2, xMaximum];
  const yTicks = mode === "linear"
    ? [0, yMaximum / 2, yMaximum]
    : Array.from({ length: Math.floor(Math.log10(yMaximum)) + 1 }, (_, index) => 10 ** index).filter((value) => value >= yMinimum && (!hash || Math.log10(value) % 3 === 0));
  const path = points.map((point, index) => `${index ? "L" : "M"}${x(point.height)},${y(point.value)}`).join(" ");
  return <article className={`history-chart-card${hash ? " history-hash-chart" : ""}`}>
    <div className="history-chart-heading"><div><h3>{title}</h3><p>{subtitle}</p></div><ScaleControl mode={mode} setMode={setMode} label={title} /></div>
    <div className="history-chart-readout"><strong>{format(selected.value)}</strong><span>{heightLabel(selected)}<br />{date.format(selected.timestamp * 1000)}{selected.current && hash ? " · rolling estimate" : ""}</span></div>
    <svg className="history-chart" viewBox="0 0 590 288" role="group" aria-labelledby={`${id}-title ${id}-description`}>
      <title id={`${id}-title`}>{title}</title>
      <desc id={`${id}-description`}>{points.length} selected blocks. {mode === "log" ? "Both axes are logarithmic, with equal ratios occupying equal distances." : "Both axes are linear."} {yLabel} versus block height. Select a point or a block button for its value. All values are also listed in the data table.</desc>
      {yTicks.map((tick) => <g key={tick}><line className="history-gridline" x1="73" x2="560" y1={y(tick)} y2={y(tick)} /><text className="history-axis" x="61" y={y(tick) + 4} textAnchor="end">{hash ? formatHashrate(tick) : compact.format(tick)}</text></g>)}
      {xTicks.map((tick) => <g key={tick}><line className="history-gridline history-vertical-grid" x1={x(tick)} x2={x(tick)} y1="44" y2="227" /><text className="history-axis" x={x(tick)} y="249" textAnchor="middle">{compact.format(tick)}</text></g>)}
      <text className="history-axis-label" x="73" y="22">{yLabel}{mode === "log" ? " · log scale" : ""}</text>
      <text className="history-axis-label" x="316" y="280" textAnchor="middle">Block height{mode === "log" ? " · log scale" : ""}</text>
      <path className="history-sample-line" d={path} />
      <line className="history-selection-line" x1={x(selected.height)} x2={x(selected.height)} y1="44" y2="227" />
      {points.map((point) => <g key={point.height} className={`history-point${selected.height === point.height ? " selected" : ""}${point.current ? " current" : ""}`} tabIndex={0} role="button" aria-label={`${heightLabel(point)}: ${format(point.value)}, ${date.format(point.timestamp * 1000)}`} aria-pressed={selected.height === point.height} onFocus={() => setSelectedHeight(point.height)} onPointerEnter={() => setSelectedHeight(point.height)} onPointerDown={() => setSelectedHeight(point.height)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedHeight(point.height); } }}>
        <circle className="history-point-hit" cx={x(point.height)} cy={y(point.value)} r="15" />
        <circle className="history-point-dot" cx={x(point.height)} cy={y(point.value)} r={point.current ? "6" : "4.5"} />
      </g>)}
    </svg>
    <PointChoices points={points} selected={selected.height} select={setSelectedHeight} />
    <p className="history-chart-note">Selected milestones, connected for comparison. {mode === "log" ? "Both axes use logarithmic scales: equal distance means equal ratio." : "Linear scales show the absolute differences; early blocks cluster together."}{hash && " Historical values estimate the whole UTC day. The latest estimate uses a different averaging window."}</p>
    <details className="history-data"><summary>View {hash ? "hashrate" : "elapsed time"} data</summary><div className="history-table-scroll"><table><caption>{yLabel} at selected heights</caption><thead><tr><th scope="col">Block</th><th scope="col">Date · UTC</th><th scope="col">{yLabel}</th></tr></thead><tbody>{points.map((point) => <tr key={point.height}><th scope="row">{integer.format(point.height)}{point.current ? " · latest" : ""}</th><td>{date.format(point.timestamp * 1000)}</td><td>{format(point.value)}</td></tr>)}</tbody></table></div></details>
  </article>;
}

function PayloadChart({ points }: { points: PayloadPoint[] }) {
  const [metric, setMetric] = useState<"transactions" | "bytes">("transactions");
  const [selectedHeight, setSelectedHeight] = useState<number | null>(null);
  const id = useId().replaceAll(":", "");
  const selected = points.find((point) => point.height === selectedHeight) ?? points.at(-1)!;
  const maximum = linearChartMaximum(Math.max(...points.map((point) => point[metric])));
  const width = 487 / points.length;
  const y = (value: number) => 225 - (value / maximum) * 179;
  const units = metric === "bytes" ? "bytes" : "transactions";
  return <article className="history-chart-card history-payload-chart">
    <div className="history-chart-heading"><div><h3>What fitted inside a block?</h3><p>Individual blocks, from 215 bytes to today</p></div><div className="history-chart-toggle" role="group" aria-label="Block payload metric"><button type="button" aria-pressed={metric === "transactions"} onClick={() => setMetric("transactions")}>Transactions</button><button type="button" aria-pressed={metric === "bytes"} onClick={() => setMetric("bytes")}>Bytes</button></div></div>
    <div className="history-chart-readout"><strong>{integer.format(selected[metric])} <small>{units}</small></strong><span>{heightLabel(selected)}<br />{date.format(selected.timestamp * 1000)}</span></div>
    <svg className="history-chart" viewBox="0 0 590 275" role="group" aria-labelledby={`${id}-title ${id}-description`}>
      <title id={`${id}-title`}>{`${metric === "bytes" ? "Serialized block sizes" : "Transaction counts"} at selected block heights`}</title>
      <desc id={`${id}-description`}>Each bar is one sampled block. Heights are categorical and evenly spaced; bar heights use a linear scale. Transaction counts include the coinbase transaction. Select bars or buttons for exact values.</desc>
      {[0, maximum / 2, maximum].map((tick) => <g key={tick}><line className="history-gridline" x1="73" x2="560" y1={y(tick)} y2={y(tick)} /><text className="history-axis" x="61" y={y(tick) + 4} textAnchor="end">{compact.format(tick)}</text></g>)}
      <text className="history-axis-label" x="73" y="24">{units[0].toUpperCase() + units.slice(1)} · linear scale</text>
      {points.map((point, index) => {
        const x = 73 + index * width;
        return <g key={point.height} className={`history-payload-point${point.height === selected.height ? " selected" : ""}`} tabIndex={0} role="button" aria-label={`${heightLabel(point)}: ${integer.format(point[metric])} ${units}`} aria-pressed={point.height === selected.height} onFocus={() => setSelectedHeight(point.height)} onPointerEnter={() => setSelectedHeight(point.height)} onPointerDown={() => setSelectedHeight(point.height)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedHeight(point.height); } }}>
          <rect className="history-payload-hit" x={x} y="40" width={width} height="190" />
          <rect className="history-payload-bar" x={x + width * .2} y={y(point[metric])} width={width * .6} height={225 - y(point[metric])} rx="2" />
          <circle className="history-payload-tip" cx={x + width / 2} cy={y(point[metric])} r="2.5" />
          <text className="history-axis" x={x + width / 2} y="250" textAnchor="middle">{point.current ? "Latest" : compact.format(point.height)}</text>
        </g>;
      })}
    </svg>
    <PointChoices points={points.map((point) => ({ ...point, value: point[metric] }))} selected={selected.height} select={setSelectedHeight} />
    <p className="history-chart-note">Sampled blocks, not the average at each height. Transaction counts include the coinbase transaction that pays the miner. Bytes are serialized block size, not virtual bytes or block weight.</p>
    <details className="history-data"><summary>View block payload data</summary><div className="history-table-scroll"><table><caption>Exact payload of each sampled block</caption><thead><tr><th scope="col">Block</th><th scope="col">Transactions</th><th scope="col">Bytes</th></tr></thead><tbody>{points.map((point) => <tr key={point.height}><th scope="row">{integer.format(point.height)}{point.current ? " · latest" : ""}</th><td>{integer.format(point.transactions)}</td><td>{integer.format(point.bytes)}</td></tr>)}</tbody></table></div></details>
  </article>;
}

export function BlockHistory({ snapshot, network }: { snapshot: ChainSnapshot | null; network: NetworkSnapshot | null }) {
  const tip = snapshot?.blocks[0];
  const currentMining = network?.mining;
  const includeTip = tip && tip.height > BLOCK_MILESTONES.at(-1)!.height;
  const elapsedPoints: HistoryPoint[] = BLOCK_MILESTONES.map((block) => ({ height: block.height, timestamp: block.timestamp, value: daysSinceGenesis(block.timestamp)! }));
  const hashPoints: HistoryPoint[] = BLOCK_MILESTONES.map((block) => ({ height: block.height, timestamp: block.timestamp, value: block.dailyHashrate }));
  const payloadPoints: PayloadPoint[] = BLOCK_MILESTONES.map((block) => ({ height: block.height, timestamp: block.timestamp, transactions: block.transactions, bytes: block.bytes }));
  if (includeTip) {
    const days = daysSinceGenesis(tip.timestamp);
    if (days !== null && days > 0) elapsedPoints.push({ height: tip.height, timestamp: tip.timestamp, value: days, current: true });
    payloadPoints.push({ height: tip.height, timestamp: tip.timestamp, transactions: tip.tx_count, bytes: tip.size, current: true });
    if (currentMining?.data.currentHashrate && currentMining.data.currentHashrate > 0) hashPoints.push({ height: tip.height, timestamp: Math.floor(currentMining.fetchedAt / 1000), value: currentMining.data.currentHashrate, current: true });
  }
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

    <div className="history-graphs-heading"><h3>Historical block comparisons</h3><p>Switch scales. Select any point. Compare the first blocks with the latest one.</p></div>
    <div className="history-chart-grid">
      <MilestoneChart title="Block height × elapsed time" subtitle="From the genesis block to each milestone" points={elapsedPoints} yLabel="Days since genesis" format={(value) => `${decimal.format(value)} days`} />
      <MilestoneChart title="Block height × network power" subtitle="A logarithmic view of Bitcoin’s computing power" points={hashPoints} yLabel="Estimated hashrate" format={formatHashrate} hash />
      <PayloadChart points={payloadPoints} />
    </div>
    <p className="history-source-note">Block headers and payloads: <a href="https://mempool.space/" target="_blank" rel="noreferrer">mempool.space</a>. Header timestamps are miner-reported. Historical hashrate: <a href="https://www.blockchain.com/explorer/charts/hash-rate" target="_blank" rel="noreferrer">Blockchain.com</a>, estimated over the whole UTC day, not measured at the instant each block was mined. The $0.29 price is the <a href={MILESTONE_PRICE_SOURCE} target="_blank" rel="noreferrer">December 29, 2010 daily average</a>; unavailable early prices are not zero. Latest network estimate: <a href="https://mempool.space/mining" target="_blank" rel="noreferrer">mempool.space</a>{currentMining ? `, retrieved ${date.format(currentMining.fetchedAt)} at ${time.format(currentMining.fetchedAt)} UTC${currentMining.stale ? " (delayed)" : ""}` : " (unavailable)"}. {snapshot?.stale && "The latest block data is delayed. "}The millionth-height estimate assumes ten minutes per remaining block.</p>
  </section>;
}
