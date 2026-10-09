"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { subsidy, type ChainSnapshot } from "@/lib/bitcoin";
import { dailyPriceComparison, GENESIS_TIME, nearestPriceIndex, samplePricePoints, selectPriceRange, type MarketResource, type MarketSnapshot, type PriceRange, type PriceScale } from "@/lib/market";
import "./market-charts.css";

const DAY = 86_400;
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const integer = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const date = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const shortDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const halvings = [
  { time: 1_354_116_278, height: 210_000, label: "2012 halving" },
  { time: 1_468_082_773, height: 420_000, label: "2016 halving" },
  { time: 1_589_225_023, height: 630_000, label: "2020 halving" },
  { time: 1_713_571_767, height: 840_000, label: "2024 halving" },
];

function PriceStatus({ resource, now, history = false }: { resource: MarketResource<unknown> | null; now: number | null; history?: boolean }) {
  if (!resource) return <span className="market-freshness">Data unavailable</span>;
  const elapsed = Math.max(0, (now ?? resource.fetchedAt) / 1000 - resource.observedAt);
  const stale = resource.stale || elapsed > (history ? 3 * DAY : 300);
  const age = elapsed < 60 ? `${Math.floor(elapsed)}s` : elapsed < 3600 ? `${Math.floor(elapsed / 60)}m` : elapsed < DAY ? `${Math.floor(elapsed / 3600)}h` : `${Math.floor(elapsed / DAY)}d`;
  return <span className={`market-freshness${stale ? " delayed" : ""}`} title={`${resource.source}: ${new Date(resource.observedAt * 1000).toUTCString()}`}>{stale ? "Delayed · " : ""}{history ? `Daily data through ${date.format(resource.observedAt * 1000)}` : `Quote ${age} ago`}</span>;
}

function moneyTick(value: number) {
  return value < 1 ? `$${Number(value.toPrecision(2))}` : `$${compact.format(value)}`;
}

export function MarketCharts({ snapshot, now }: { snapshot: ChainSnapshot | null; now: number | null }) {
  const [market, setMarket] = useState<MarketSnapshot | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [range, setRange] = useState<PriceRange>("All");
  const [scale, setScale] = useState<PriceScale>("log");
  const [selected, setSelected] = useState<number | null>(null);
  const active = useRef<AbortController | null>(null);
  const id = useId().replaceAll(":", "");

  useEffect(() => {
    let mounted = true;
    async function refresh() {
      if (active.current) return;
      const controller = new AbortController();
      active.current = controller;
      const timeout = window.setTimeout(() => controller.abort(), 18_000);
      try {
        const response = await fetch("/api/market", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Market data unavailable");
        const data: MarketSnapshot = await response.json();
        if (mounted) { setMarket(data); setUnavailable(!data.history && !data.spot); }
      } catch {
        if (mounted) setUnavailable(true);
      } finally {
        clearTimeout(timeout);
        if (active.current === controller) active.current = null;
      }
    }
    void refresh();
    const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, 60_000);
    const visible = () => { if (!document.hidden) void refresh(); else active.current?.abort(); };
    document.addEventListener("visibilitychange", visible);
    return () => { mounted = false; clearInterval(timer); document.removeEventListener("visibilitychange", visible); active.current?.abort(); active.current = null; };
  }, []);

  const history = market?.history ?? null;
  const spot = market?.spot ?? null;
  const points = useMemo(() => selectPriceRange(history?.data.points ?? [], range), [history, range]);
  const sampled = useMemo(() => samplePricePoints(points), [points]);
  const selectedIndex = selected === null ? points.length - 1 : nearestPriceIndex(points, selected);
  const point = points[selectedIndex];
  const comparison = dailyPriceComparison(history?.data.points ?? [], spot ? { usd: spot.data.usd, observedAt: spot.observedAt } : null);
  const quote = spot?.data.usd;
  const block = snapshot?.blocks[0];
  const blockSubsidy = block ? subsidy(block.height) : null;
  const subsidyValue = blockSubsidy !== null && quote !== undefined ? blockSubsidy * quote : null;
  const firstTime = points[0]?.timestamp ?? GENESIS_TIME + DAY;
  const lastTime = points.at(-1)?.timestamp ?? firstTime + DAY;
  const logY = scale !== "linear";
  const logX = scale === "loglog";
  const rawMin = points.length ? Math.min(...points.map((item) => item.usd)) : 1;
  const rawMax = points.length ? Math.max(...points.map((item) => item.usd)) : 10;
  const lower = logY ? Math.floor(Math.log10(rawMin)) : 0;
  const upper = logY ? Math.max(lower + 1, Math.ceil(Math.log10(rawMax))) : Math.max(1, Math.ceil(rawMax / 4 / 10 ** Math.floor(Math.log10(rawMax / 4))) * 10 ** Math.floor(Math.log10(rawMax / 4)) * 4);
  const xValue = (timestamp: number) => logX ? Math.log10((timestamp - GENESIS_TIME) / DAY) : timestamp;
  const xMin = xValue(firstTime);
  const xMax = xValue(lastTime);
  const x = (timestamp: number) => 76 + (xValue(timestamp) - xMin) / Math.max(0.000001, xMax - xMin) * 660;
  const y = (usd: number) => 278 - ((logY ? Math.log10(usd) : usd) - lower) / (upper - lower) * 234;
  const ticks = logY ? Array.from({ length: Math.ceil(upper - lower) + 1 }, (_, index) => 10 ** (lower + index)) : Array.from({ length: 5 }, (_, index) => index * upper / 4);
  const line = sampled.map((item, index) => `${index ? "L" : "M"}${x(item.timestamp).toFixed(2)},${y(item.usd).toFixed(2)}`).join(" ");
  const markers = halvings.filter((halving) => halving.time >= firstTime && halving.time <= lastTime);
  const logDayTicks = Array.from({ length: 8 }, (_, index) => [1, 2, 5].map((multiple) => multiple * 10 ** index)).flat().filter((days) => days >= (firstTime - GENESIS_TIME) / DAY && days <= (lastTime - GENESIS_TIME) / DAY);
  const fallbackLogDays = Array.from({ length: 4 }, (_, index) => Math.round(10 ** (xMin + (xMax - xMin) * index / 3)));
  const xTicks = logX ? [...new Set(logDayTicks.length >= 2 ? logDayTicks : fallbackLogDays)].map((days) => ({ timestamp: Math.max(firstTime, Math.min(lastTime, GENESIS_TIME + days * DAY)), label: integer.format(days) })) : Array.from({ length: 4 }, (_, index) => { const timestamp = firstTime + (lastTime - firstTime) * index / 3; return { timestamp, label: range === "All" ? String(new Date(timestamp * 1000).getUTCFullYear()) : shortDate.format(timestamp * 1000) }; });
  const firstPoint = history?.data.points[0];

  function selectFromPointer(event: React.PointerEvent<SVGSVGElement>) {
    const svg = event.currentTarget;
    const matrix = svg.getScreenCTM();
    if (!matrix || !points.length) return;
    const location = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    const fraction = Math.max(0, Math.min(1, (location.x - 76) / 660));
    const projected = xMin + fraction * (xMax - xMin);
    const timestamp = logX ? GENESIS_TIME + 10 ** projected * DAY : projected;
    setSelected(points[nearestPriceIndex(points, timestamp)].timestamp);
  }

  return <section id="bitcoin-price" className="market-section shell content-section" aria-labelledby="market-heading">
    <div className="market-heading">
      <div><p className="market-kicker">Bitcoin / US dollar</p><h2 id="market-heading">Bitcoin price</h2></div>
      <p>Price history alongside Bitcoin’s halvings.{" "}<br />USD values are nominal, before inflation.</p>
    </div>
    <dl className="market-metrics">
      <div className="market-quote"><dt>Bitcoin price</dt><dd>{quote === undefined ? "—" : money.format(quote)}</dd><PriceStatus resource={spot} now={now} /><p>{spot?.source === "coinbase.com" ? "Coinbase BTC–USD quote" : "mempool.space USD quote"}</p></div>
      <div><dt>Since the last daily reference</dt><dd className={comparison ? comparison.percent >= 0 ? "positive" : "negative" : ""}>{comparison ? `${comparison.percent >= 0 ? "+" : ""}${comparison.percent.toFixed(2)}%` : "—"}</dd><p>{comparison ? `Compared with ${money.format(comparison.point.usd)} on ${date.format(comparison.point.timestamp * 1000)}` : "Waiting for a recent daily price"}</p><span className="market-freshness">Daily reference, not a rolling 24h change</span></div>
      <div><dt>Satoshis per US dollar</dt><dd>{quote === undefined ? "—" : integer.format(100_000_000 / quote)}<span>sats</span></dd><p>100,000,000 satoshis = 1 BTC</p><span className="market-freshness">At the quoted price, before fees</span></div>
      <div><dt>Block subsidy value</dt><dd>{subsidyValue === null ? "—" : money.format(subsidyValue)}</dd><p>{blockSubsidy === null ? "Waiting for the latest block" : `${blockSubsidy} BTC × the quoted USD price`}</p><span className="market-freshness">New coins per block · excludes transaction fees{snapshot?.stale ? " · block feed delayed" : ""}</span></div>
    </dl>

    <article className="market-chart-card">
      <div className="market-chart-header">
        <div><h3>Bitcoin price history</h3><PriceStatus resource={history} now={now} history /></div>
        <div className="market-controls">
          <div className="market-toggle" role="group" aria-label="Price history time range">{(["30D", "1Y", "All"] as const).map((item) => <button key={item} type="button" aria-pressed={range === item} onClick={() => { setRange(item); setSelected(null); }}>{item}</button>)}</div>
          <div className="market-toggle" role="group" aria-label="Price chart scale">{([{ value: "linear", label: "Linear" }, { value: "log", label: "Log price" }, { value: "loglog", label: "Log–log" }] as const).map((item) => <button key={item.value} type="button" aria-pressed={scale === item.value} onClick={() => setScale(item.value)}>{item.label}</button>)}</div>
        </div>
      </div>
      <div className="market-chart-readout"><strong>{point ? money.format(point.usd) : "—"}</strong><span>{point ? `${date.format(point.timestamp * 1000)} · daily reference` : "Loading price history"}</span></div>
      {points.length >= 2 ? <>
        <svg className="market-chart" viewBox="0 0 760 340" role="img" aria-labelledby={`${id}-title ${id}-description`} onPointerMove={selectFromPointer} onPointerDown={selectFromPointer}>
          <title id={`${id}-title`}>{`Bitcoin price in US dollars, ${scale === "loglog" ? "logarithmic on both axes" : logY ? "logarithmic price scale" : "linear scale"}`}</title>
          <desc id={`${id}-description`}>{points.length} daily observations from {date.format(firstTime * 1000)} to {date.format(lastTime * 1000)}. {logX ? "Horizontal axis: days since Bitcoin’s genesis block on a base-10 logarithmic scale. " : "Horizontal axis: date. "}Vertical axis: USD, {logY ? "base-10 logarithmic" : "linear"}. Use the slider below to inspect every daily observation.</desc>
          <defs><linearGradient id={`${id}-price-fill`} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#ff781f" stopOpacity=".2" /><stop offset="100%" stopColor="#ff781f" stopOpacity="0" /></linearGradient></defs>
          {ticks.map((tick) => <g key={tick}><line className="market-gridline" x1="76" x2="736" y1={y(tick)} y2={y(tick)} /><text className="market-axis" x="65" y={y(tick) + 5} textAnchor="end">{moneyTick(tick)}</text></g>)}
          <text className="market-axis market-unit" x="76" y="23">USD {logY ? "· log scale" : "· linear scale"}</text>
          {markers.map((marker, index) => <g key={marker.height}><line className="market-halving-line" x1={x(marker.time)} x2={x(marker.time)} y1="40" y2="278" /><text className="market-halving-label" x={x(marker.time) + 5} y={58 + index % 2 * 18}>{marker.label.slice(0, 4)}</text></g>)}
          <path d={`${line} L${x(lastTime)},278 L${x(firstTime)},278 Z`} fill={`url(#${id}-price-fill)`} />
          <path d={line} className="market-price-line" />
          {point && <g><line className="market-selection" x1={x(point.timestamp)} x2={x(point.timestamp)} y1="40" y2="278" /><circle className="market-selected-point" cx={x(point.timestamp)} cy={y(point.usd)} r="5" /></g>}
          {xTicks.map((tick) => <g key={tick.timestamp}>{logX && <line className="market-gridline" x1={x(tick.timestamp)} x2={x(tick.timestamp)} y1="40" y2="278" />}<text className="market-axis" x={x(tick.timestamp)} y="301" textAnchor={x(tick.timestamp) < 110 ? "start" : x(tick.timestamp) > 690 ? "end" : "middle"}>{tick.label}</text></g>)}
          <text className="market-axis market-axis-caption" x="406" y="330" textAnchor="middle">{logX ? "Days since genesis · log scale" : "Date · UTC"}</text>
        </svg>
        <div className="market-slider"><label htmlFor={`${id}-slider`}>Explore daily prices <span>Drag the chart or use arrow keys</span></label><input id={`${id}-slider`} type="range" min="0" max={points.length - 1} value={selectedIndex} step="1" aria-valuetext={point ? `${date.format(point.timestamp * 1000)}: ${money.format(point.usd)}` : undefined} onChange={(event) => setSelected(points[Number(event.target.value)].timestamp)} /></div>
      </> : <div className="market-empty"><span>{unavailable ? "Price history is temporarily unavailable" : "Loading Bitcoin price history…"}</span><p>The block countdown continues independently.</p></div>}
      <div className="market-chart-explanation"><p><span className="market-legend-line" />Daily price{markers.length > 0 && <><span className="market-legend-halving" />Block subsidy halvings</>}</p><p>{scale === "linear" ? "Equal vertical distances show equal dollar changes." : scale === "log" ? "Equal vertical distances show equal price multiples. Each labeled step is 10×." : "Both axes are logarithmic: equal distances show equal multiples of price and of days since genesis. Tick labels show actual days and dollars. This is historical data, not a price model."}</p></div>
      {firstPoint && <p className="market-history-note">This dataset begins at {money.format(firstPoint.usd)} on {date.format(firstPoint.timestamp * 1000)}. Earlier zero placeholders are omitted; they do not mean Bitcoin was worth $0. The line is simplified for display; the slider reads every daily observation.</p>}
    </article>
    <p className="market-source-note">Daily history: <a href="https://www.blockchain.com/explorer/charts/market-price" target="_blank" rel="noreferrer">Blockchain.com market price</a>. Current quote: <a href={spot?.source === "coinbase.com" ? "https://www.coinbase.com/price/bitcoin" : "https://mempool.space/"} target="_blank" rel="noreferrer">{spot?.source ?? "mempool.space"}</a>. Sources aggregate different markets, so prices can differ. Historical data updates separately from the current quote; all dates are UTC.{unavailable && (history || spot) ? " The latest request failed; retained observations keep their original timestamps." : ""}</p>
  </section>;
}
