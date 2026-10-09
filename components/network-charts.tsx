"use client";

import { useId, useState } from "react";
import type { ChainSnapshot } from "@/lib/bitcoin";
import type { NetworkSnapshot } from "@/lib/network";
import { blockIntervals, recentActivity } from "@/lib/block-stats";
import "./network-charts.css";

type Feed = { fetchedAt: number; stale?: boolean; source: string } | null;
const MINING_TTL = 10 * 60 * 1000;
const NETWORK_TTL = 2 * 60 * 1000;
const CHAIN_TTL = 2 * 60 * 1000;
const integer = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const shortDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const fullDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

function numeric(value: number | null | undefined, places = 1) {
  return value == null || !Number.isFinite(value) ? "—" : places === 0 ? integer.format(value) : decimal.format(value);
}

function FeedStatus({ feed, now, ttl = NETWORK_TTL }: { feed: Feed; now: number | null; ttl?: number }) {
  if (!feed) return <span className="network-freshness unavailable">Data unavailable</span>;
  const seconds = now === null ? 0 : Math.max(0, Math.floor((now - feed.fetchedAt) / 1000));
  const stale = feed.stale || seconds * 1000 > ttl;
  const age = seconds < 60 ? `${seconds}s` : seconds < 3600 ? `${Math.floor(seconds / 60)}m` : `${Math.floor(seconds / 3600)}h`;
  return <span className={`network-freshness${stale ? " stale" : ""}`} title={`Source: ${feed.source}. ${new Date(feed.fetchedAt).toUTCString()}`}>
    {stale ? "Delayed · " : "Updated "}{age} ago
  </span>;
}

function Metric({ label, value, unit, detail, feed, now, ttl }: {
  label: string; value: string; unit?: string; detail: string; feed: Feed; now: number | null; ttl?: number;
}) {
  return <div className="network-metric">
    <dt>{label}</dt>
    <dd>{value}{unit && <span>{unit}</span>}</dd>
    <p>{detail}</p>
    <FeedStatus feed={feed} now={now} ttl={ttl} />
  </div>;
}

export function NetworkCharts({ snapshot, network, now }: {
  snapshot: ChainSnapshot | null;
  network: NetworkSnapshot | null;
  now: number | null;
}) {
  const mining = network?.mining ?? null;
  const difficulty = network?.difficulty ?? null;
  const mempool = network?.mempool ?? null;
  const blocks = snapshot?.blocks.slice(0, 10) ?? [];
  const activity = recentActivity(blocks);
  const intervals = blockIntervals(blocks);
  const adjustment = difficulty?.data.difficultyChange;
  const adjustmentText = adjustment == null ? "—" : `${adjustment > 0 ? "+" : ""}${numeric(adjustment)}%`;
  const retargetDate = difficulty ? shortDate.format(difficulty.data.estimatedRetargetDate) : null;
  const hashData = (mining?.data.hashrates ?? [])
    .filter((point) => Number.isFinite(point.timestamp) && Number.isFinite(point.avgHashrate) && point.avgHashrate >= 0)
    .map((point) => ({ timestamp: point.timestamp, value: point.avgHashrate / 1e18 }))
    .sort((a, b) => a.timestamp - b.timestamp);
  const [selectedHash, setSelectedHash] = useState<number | null>(null);
  const [selectedBlock, setSelectedBlock] = useState<number | null>(null);
  const hashPoint = hashData.find((point) => point.timestamp === selectedHash) ?? hashData.at(-1);
  const interval = intervals.find((point) => point.height === selectedBlock) ?? intervals.at(-1);
  const id = useId().replaceAll(":", "");
  const hashTitleId = `${id}-hash-title`;
  const hashDescId = `${id}-hash-description`;
  const blockTitleId = `${id}-block-title`;
  const blockDescId = `${id}-block-description`;
  const hashMin = hashData.length ? Math.max(0, Math.floor(Math.min(...hashData.map((point) => point.value)) * 0.95 / 50) * 50) : 0;
  const hashMax = hashData.length ? Math.max(hashMin + 50, Math.ceil(Math.max(...hashData.map((point) => point.value)) * 1.05 / 50) * 50) : 100;
  const firstTime = hashData[0]?.timestamp ?? 0;
  const lastTime = hashData.at(-1)?.timestamp ?? firstTime + 1;
  const hashX = (timestamp: number) => 58 + ((timestamp - firstTime) / Math.max(1, lastTime - firstTime)) * 438;
  const hashY = (value: number) => 190 - ((value - hashMin) / (hashMax - hashMin)) * 160;
  const line = hashData.map((point, index) => `${index ? "L" : "M"}${hashX(point.timestamp)},${hashY(point.value)}`).join(" ");
  const maxMinutes = Math.max(20, ...intervals.map((point) => point.seconds === null ? 0 : Math.ceil(point.seconds / 600) * 10));
  const barY = (minutes: number) => 190 - (minutes / maxMinutes) * 160;
  const barWidth = 438 / Math.max(1, intervals.length);
  const hashTicks = [hashMin, (hashMax + hashMin) / 2, hashMax];
  const blockTicks = [0, maxMinutes / 2, maxMinutes];

  return <section id="network" className="network-section shell content-section" aria-labelledby="network-heading">
    <div className="network-heading">
      <div><p className="network-kicker">Bitcoin network</p><h2 id="network-heading">Mining and network activity</h2></div>
      <p>Mining, congestion and the latest blocks.{" "}<br />Times and dates are in UTC.</p>
    </div>

    <dl className="network-metrics">
      <Metric label="Estimated hashrate" value={numeric(mining ? mining.data.currentHashrate / 1e18 : null, 0)} unit="EH/s" detail="Estimated computing power securing Bitcoin" feed={mining} now={now} ttl={MINING_TTL} />
      <Metric label="Mining difficulty" value={numeric(mining ? mining.data.currentDifficulty / 1e12 : null)} unit="T" detail="Trillions × Bitcoin’s original difficulty" feed={mining} now={now} ttl={MINING_TTL} />
      <Metric label="Next difficulty adjustment" value={adjustmentText} detail={difficulty ? `${integer.format(difficulty.data.remainingBlocks)} blocks left · estimated ${retargetDate}` : "Recalculated every 2,016 blocks"} feed={difficulty} now={now} />
      <Metric label="Average block time" value={numeric(difficulty ? difficulty.data.timeAvg / 60_000 : null)} unit="min" detail="Current difficulty period · target 10 min" feed={difficulty} now={now} />
      <Metric label="Transactions waiting" value={numeric(mempool?.data.count, 0)} detail={mempool ? `${numeric(mempool.data.vsize / 1e6)} million virtual bytes queued` : "Provider’s view of unconfirmed transactions"} feed={mempool} now={now} />
      <Metric label="Average block fullness" value={numeric(activity.fullness)} unit="%" detail={blocks.length ? `Last ${blocks.length} blocks · 4M weight units per block` : "Share of block weight capacity used"} feed={snapshot} now={now} ttl={CHAIN_TTL} />
    </dl>

    <div className="network-chart-grid">
      <article className="network-chart-card">
        <div className="network-chart-heading"><h3>Hashrate · 30 days</h3><FeedStatus feed={mining} now={now} ttl={MINING_TTL} /></div>
        <div className="network-chart-readout" aria-live="off">
          <strong>{numeric(hashPoint?.value, 0)} <span>EH/s</span></strong>
          <span>{hashPoint ? fullDate.format(hashPoint.timestamp * 1000) : "Waiting for mining data"}</span>
        </div>
        {hashData.length ? <svg className="network-chart" viewBox="0 0 520 236" role="group" aria-labelledby={`${hashTitleId} ${hashDescId}`}>
          <title id={hashTitleId}>Estimated Bitcoin hashrate over the last 30 days</title>
          <desc id={hashDescId}>{hashData.length} observations, from {numeric(hashData[0].value)} to {numeric(hashData.at(-1)?.value)} exahashes per second. Select a point to read its date and value. The same data is available in the table below.</desc>
          <defs><linearGradient id={`${id}-hash-fill`} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#ff781f" stopOpacity=".22" /><stop offset="100%" stopColor="#ff781f" stopOpacity="0" /></linearGradient></defs>
          {hashTicks.map((tick) => <g key={tick}><line className="chart-gridline" x1="58" x2="496" y1={hashY(tick)} y2={hashY(tick)} /><text className="chart-axis" x="47" y={hashY(tick) + 5} textAnchor="end">{integer.format(tick)}</text></g>)}
          <text className="chart-axis" x="58" y="16">EH/s</text>
          <path d={`${line} L${hashX(lastTime)},190 L58,190 Z`} fill={`url(#${id}-hash-fill)`} />
          <path d={line} className="hash-line" />
          {hashPoint && <line className="chart-selection" x1={hashX(hashPoint.timestamp)} x2={hashX(hashPoint.timestamp)} y1="26" y2="190" />}
          {hashData.map((point) => <circle key={point.timestamp} className={`hash-point${point.timestamp === hashPoint?.timestamp ? " selected" : ""}`} cx={hashX(point.timestamp)} cy={hashY(point.value)} r="7" tabIndex={0} role="button" aria-label={`${fullDate.format(point.timestamp * 1000)}: ${numeric(point.value)} exahashes per second`} aria-pressed={point.timestamp === hashPoint?.timestamp} onFocus={() => setSelectedHash(point.timestamp)} onPointerEnter={() => setSelectedHash(point.timestamp)} onPointerDown={() => setSelectedHash(point.timestamp)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedHash(point.timestamp); } }} />)}
          <text className="chart-axis" x="58" y="217">{shortDate.format(firstTime * 1000)}</text>
          {lastTime > firstTime && <text className="chart-axis" x="496" y="217" textAnchor="end">{shortDate.format(lastTime * 1000)}</text>}
        </svg> : <div className="network-chart-empty"><span>Hashrate history unavailable</span><p>The other statistics update independently.</p></div>}
        <p className="network-chart-note">Hashrate is estimated from mined blocks. Hover, tap or focus a point to inspect it.</p>
        {hashData.length > 0 && <details className="network-data-table"><summary>View hashrate data</summary><div className="network-table-scroll"><table><caption>Estimated Bitcoin hashrate, UTC</caption><thead><tr><th scope="col">Date</th><th scope="col">EH/s</th></tr></thead><tbody>{hashData.map((point) => <tr key={point.timestamp}><th scope="row">{fullDate.format(point.timestamp * 1000)}</th><td>{numeric(point.value)}</td></tr>)}</tbody></table></div></details>}
      </article>

      <article className="network-chart-card">
        <div className="network-chart-heading"><h3>Recent block intervals</h3><FeedStatus feed={snapshot} now={now} ttl={CHAIN_TTL} /></div>
        <div className="network-chart-readout" aria-live="off">
          <strong>{numeric(interval?.seconds == null ? null : interval.seconds / 60)} <span>min</span></strong>
          <span>{interval ? `Block ${integer.format(interval.height)}${interval.seconds === null ? " · interval unavailable" : ""}` : "Waiting for block data"}</span>
        </div>
        {intervals.length ? <svg className="network-chart" viewBox="0 0 520 236" role="group" aria-labelledby={`${blockTitleId} ${blockDescId}`}>
          <title id={blockTitleId}>Time between the latest Bitcoin blocks</title>
          <desc id={blockDescId}>{intervals.length} intervals shown. The target is ten minutes; recent average is {numeric(activity.averageSeconds === null ? null : activity.averageSeconds / 60)} minutes. Missing or non-positive timestamp intervals are unavailable, not zero. The table below contains every value.</desc>
          {blockTicks.map((tick) => <g key={tick}><line className="chart-gridline" x1="58" x2="496" y1={barY(tick)} y2={barY(tick)} /><text className="chart-axis" x="47" y={barY(tick) + 5} textAnchor="end">{numeric(tick, 0)}</text></g>)}
          <text className="chart-axis" x="58" y="16">min</text>
          <line className="chart-target" x1="58" x2="496" y1={barY(10)} y2={barY(10)} />
          <text className="chart-target-label" x="496" y={barY(10) - 7} textAnchor="end">10 min target</text>
          {intervals.map((point, index) => {
            const x = 58 + index * barWidth;
            const y = point.seconds === null ? 187 : barY(point.seconds / 60);
            return <g key={point.height} className={`interval-point${point.height === interval?.height ? " selected" : ""}`} tabIndex={0} role="button" aria-label={`Block ${integer.format(point.height)}: ${point.seconds === null ? "interval unavailable" : `${numeric(point.seconds / 60)} minutes`}`} aria-pressed={point.height === interval?.height} onFocus={() => setSelectedBlock(point.height)} onPointerEnter={() => setSelectedBlock(point.height)} onPointerDown={() => setSelectedBlock(point.height)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedBlock(point.height); } }}>
              <rect className="interval-hit" x={x} y="28" width={barWidth} height="164" />
              {point.seconds === null ? <text className="chart-missing" x={x + barWidth / 2} y="179" textAnchor="middle">—</text> : <rect className="interval-bar" x={x + barWidth * 0.16} y={y} width={barWidth * 0.68} height={190 - y} rx="2" />}
            </g>;
          })}
          <text className="chart-axis" x="58" y="217">#{integer.format(intervals[0].height)}</text>
          <text className="chart-axis" x="496" y="217" textAnchor="end">#{integer.format(intervals.at(-1)!.height)}</text>
        </svg> : <div className="network-chart-empty"><span>Recent intervals unavailable</span><p>At least two consecutive blocks are needed.</p></div>}
        <p className="network-chart-note">{activity.averageSeconds === null ? "Average pace unavailable." : `${numeric(activity.averageSeconds / 60)} min average over ${intervals.length} intervals.`} {activity.transactionsPerSecond !== null && `${numeric(activity.transactionsPerSecond)} confirmed transactions/sec in this window.`} Block timestamps are miner-reported.</p>
        {intervals.length > 0 && <details className="network-data-table"><summary>View block interval data</summary><div className="network-table-scroll"><table><caption>Intervals from consecutive block timestamps</caption><thead><tr><th scope="col">Block height</th><th scope="col">Minutes</th></tr></thead><tbody>{intervals.map((point) => <tr key={point.height}><th scope="row">{integer.format(point.height)}</th><td>{point.seconds === null ? "Unavailable" : numeric(point.seconds / 60)}</td></tr>)}</tbody></table></div></details>}
      </article>
    </div>
    <p className="network-source-note">Mining data: <a href="https://mempool.space/mining" target="_blank" rel="noreferrer">mempool.space</a>. Block data: <a href={snapshot?.source === "blockstream.info" ? "https://blockstream.info/" : "https://mempool.space/"} target="_blank" rel="noreferrer">{snapshot?.source ?? "mempool.space / Blockstream"}</a>. The transaction queue is the provider’s node view; it can differ between nodes. Difficulty adjustments are estimates until the period ends.</p>
  </section>;
}
