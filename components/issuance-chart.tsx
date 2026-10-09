"use client";

import { useId, useState } from "react";
import { TARGET, type ChainSnapshot } from "@/lib/bitcoin";
import { blockSubsidySatoshis, scheduledIssuedSatoshis, SATOSHIS_PER_BITCOIN } from "@/lib/issuance";
import "./issuance-chart.css";

const integer = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const bitcoin = new Intl.NumberFormat("en-US", { maximumFractionDigits: 8 });
const checkpoints = [0, 210_000, 420_000, 630_000, 840_000, TARGET];
const curveHeights = [0, 209_999, 210_000, 419_999, 420_000, 629_999, 630_000, 839_999, 840_000, TARGET];
const labels = ["Genesis", "1st halving", "2nd halving", "3rd halving", "4th halving", "Block 1 million"];
const X_START = 66;
const X_END = 896;
const Y_START = 38;
const Y_END = 286;
const x = (height: number) => X_START + height / TARGET * (X_END - X_START);
const btcIssued = (height: number) => scheduledIssuedSatoshis(height) / SATOSHIS_PER_BITCOIN;
const btcSubsidy = (height: number) => blockSubsidySatoshis(height) / SATOSHIS_PER_BITCOIN;

export function IssuanceChart({ snapshot }: { snapshot: ChainSnapshot | null }) {
  const [selected, setSelected] = useState(TARGET);
  const [mode, setMode] = useState<"total" | "subsidy">("total");
  const id = useId().replaceAll(":", "");
  const current = snapshot?.blocks[0]?.height;
  const currentOnChart = current !== undefined && current >= 0 && current <= TARGET;
  const isTotal = mode === "total";
  const yMax = isTotal ? 21_000_000 : 50;
  const y = (value: number) => Y_END - value / yMax * (Y_END - Y_START);
  const valueAt = isTotal ? btcIssued : btcSubsidy;
  const selectedValue = valueAt(selected);
  const ticks = isTotal ? [0, 5_000_000, 10_000_000, 15_000_000, 21_000_000] : [0, 12.5, 25, 37.5, 50];
  const path = isTotal
    ? curveHeights.map((height, index) => `${index ? "L" : "M"}${x(height)},${y(btcIssued(height))}`).join(" ")
    : checkpoints.map((height, index) => index === 0
      ? `M${x(height)},${y(btcSubsidy(height))}`
      : `H${x(height)} V${y(btcSubsidy(height))}`).join(" ");

  return <section id="bitcoin-issuance" className="issuance-section shell content-section" aria-labelledby={`${id}-heading`}>
    <div className="issuance-heading">
      <div><p className="issuance-kicker">Supply schedule</p><h2 id={`${id}-heading`}>Bitcoin issuance at block 1,000,000</h2></div>
      <p>Four halvings on the way to a million.{" "}<br />Explore the reward at any block height.</p>
    </div>
    <div className="issuance-card">
      <div className="issuance-toolbar">
        <div className="issuance-modes" role="group" aria-label="Issuance chart measure">
          <button type="button" aria-pressed={isTotal} onClick={() => setMode("total")}>Total issuance</button>
          <button type="button" aria-pressed={!isTotal} onClick={() => setMode("subsidy")}>Block subsidy</button>
        </div>
        <span className="issuance-schedule-label">Defined by the subsidy schedule</span>
      </div>
      <dl className="issuance-readout" aria-live="off">
        <div><dt>Selected block height</dt><dd>{integer.format(selected)}</dd></div>
        <div><dt>Scheduled issuance through this block</dt><dd>{bitcoin.format(btcIssued(selected))}<span>BTC</span></dd></div>
        <div><dt>Subsidy in this block</dt><dd>{bitcoin.format(btcSubsidy(selected))}<span>BTC</span></dd></div>
      </dl>
      <figure className="issuance-figure">
        <svg className="issuance-plot" viewBox="0 0 936 344" role="img" aria-labelledby={`${id}-title ${id}-description`}>
          <title id={`${id}-title`}>{`${isTotal ? "Scheduled Bitcoin issuance" : "Bitcoin block subsidy"} from genesis to block 1,000,000`}</title>
          <desc id={`${id}-description`}>Both axes are linear. At the selected height {integer.format(selected)}, {isTotal ? "scheduled issuance is" : "the block subsidy is"} {bitcoin.format(selectedValue)} BTC. Halvings occur at heights 210,000, 420,000, 630,000 and 840,000. Use the slider and buttons below to explore. A data table follows.</desc>
          <defs><linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ff781f" stopOpacity=".22" /><stop offset="100%" stopColor="#ff781f" stopOpacity=".015" /></linearGradient></defs>
          {ticks.map((tick) => <g key={tick}><line className="issuance-gridline" x1={X_START} x2={X_END} y1={y(tick)} y2={y(tick)} /><text className="issuance-axis" x={X_START - 12} y={y(tick) + 4} textAnchor="end">{isTotal && tick > 0 ? `${tick / 1_000_000}M` : bitcoin.format(tick)}</text></g>)}
          <text className="issuance-axis" x={X_START} y="19">{isTotal ? "Scheduled BTC" : "BTC per block"}</text>
          {checkpoints.slice(1, -1).map((height, index) => <g key={height}><line className="issuance-halving" x1={x(height)} x2={x(height)} y1={Y_START} y2={Y_END} /><text className="issuance-halving-label" x={x(height) + 5} y="57">H{index + 1}</text></g>)}
          <path d={`${path} L${X_END},${Y_END} L${X_START},${Y_END} Z`} fill={`url(#${id}-fill)`} />
          <path className="issuance-line" d={path} />
          {currentOnChart && <g><line className="issuance-current-line" x1={x(current)} x2={x(current)} y1={Y_START} y2={Y_END} /><circle className="issuance-current-point" cx={x(current)} cy={y(valueAt(current))} r="5" /></g>}
          <line className="issuance-selected-line" x1={x(selected)} x2={x(selected)} y1={Y_START} y2={Y_END} />
          <circle className="issuance-selected-ring" cx={x(selected)} cy={y(selectedValue)} r="9" />
          <circle className="issuance-selected-point" cx={x(selected)} cy={y(selectedValue)} r="4" />
          {checkpoints.map((height) => <text key={height} className="issuance-axis" x={x(height)} y="310" textAnchor={height === 0 ? "start" : height === TARGET ? "end" : "middle"}>{height === 0 ? "0" : height === TARGET ? "1M" : `${height / 1000}k`}</text>)}
          <text className="issuance-axis" x={X_END} y="335" textAnchor="end">Block height</text>
        </svg>
        <figcaption className="issuance-legend"><span><i className="issuance-legend-selected" />Selected height</span><span><i className="issuance-legend-current" />{current === undefined ? "Current height loading" : `${snapshot?.stale ? "Last known" : "Current"} height ${integer.format(current)}${!currentOnChart ? " · beyond chart" : ""}`}</span><span>H1–H4 = halvings</span></figcaption>
      </figure>
      <div className="issuance-scrubber">
        <label htmlFor={`${id}-height`}>Explore block height <output htmlFor={`${id}-height`}>{integer.format(selected)}</output></label>
        <input id={`${id}-height`} type="range" min="0" max={TARGET} step="1" value={selected} aria-valuetext={`Block ${integer.format(selected)}. Scheduled issuance ${bitcoin.format(btcIssued(selected))} BTC. Block subsidy ${bitcoin.format(btcSubsidy(selected))} BTC.`} onChange={(event) => setSelected(Number(event.target.value))} />
        <div className="issuance-presets" role="group" aria-label="Select an issuance milestone">{checkpoints.map((height, index) => <button key={height} type="button" aria-pressed={selected === height} onClick={() => setSelected(height)}><span>{labels[index]}</span><small>{integer.format(height)}</small></button>)}</div>
      </div>
      <p className="issuance-note">Scheduled issuance includes the unspendable 50 BTC genesis subsidy and does not subtract unclaimed rewards. It is not circulating supply. Block 1,000,000 keeps the 3.125 BTC subsidy; the next halving is at 1,050,000. <a href="https://github.com/bitcoin/bitcoin/blob/master/src/validation.cpp" target="_blank" rel="noreferrer">Bitcoin Core subsidy rules ↗</a></p>
      <details className="issuance-data"><summary>View issuance milestone data</summary><div className="issuance-table-scroll"><table><caption>Scheduled issuance, including the selected block</caption><thead><tr><th scope="col">Block height</th><th scope="col">Scheduled BTC</th><th scope="col">Subsidy (BTC)</th></tr></thead><tbody>{checkpoints.map((height) => <tr key={height}><th scope="row">{integer.format(height)}</th><td>{bitcoin.format(btcIssued(height))}</td><td>{bitcoin.format(btcSubsidy(height))}</td></tr>)}</tbody></table></div></details>
    </div>
  </section>;
}
