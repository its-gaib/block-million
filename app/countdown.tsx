"use client";
import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Share2,
  MapPin,
  Copy,
  Expand,
  Code,
  Radio,
  RotateCcw,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Progress } from "@/components/ui/progress";
import {
  Block,
  ChainSnapshot,
  TARGET,
  blocksRemaining,
  estimateArrival,
  subsidy,
} from "@/lib/bitcoin";
import { track } from "@/lib/track";
const fmt = (n: number) => n.toLocaleString("en-US");
const pad = (n: number) => String(n).padStart(2, "0");
const repo = "https://github.com/its-gaib/height-million";
const faq = [
  [
    "When will Bitcoin reach block 1,000,000?",
    "There is no fixed date. Our estimate starts at the latest block’s timestamp and adds 10 minutes for each remaining block. It updates as the chain grows. Real blocks can arrive seconds or hours apart, so treat this as an estimate, not a calendar appointment.",
  ],
  [
    "Is block 1,000,000 a Bitcoin halving?",
    "No. One million is a cultural milestone, not a protocol change. The block subsidy at height 1,000,000 is 3.125 BTC, plus transaction fees. The next halving is at height 1,050,000, when the subsidy becomes 1.5625 BTC.",
  ],
  [
    "Why count block height instead of total blocks?",
    "Bitcoin begins with the genesis block at height 0. Height 1,000,000 is therefore the 1,000,001st block including genesis. This site celebrates the block labeled 1,000,000, the number you will see in a block explorer.",
  ],
  [
    "Where does the live data come from?",
    "We read the active Bitcoin chain from mempool.space, with Blockstream as a fallback. The site checks every 30 seconds while visible. If fresh data is unavailable, we keep the last known values and clearly label them. The block-drop preview never changes real data.",
  ],
];
function Cube({
  block,
  latest = false,
  pending = false,
}: {
  block?: Block;
  latest?: boolean;
  pending?: boolean;
}) {
  return (
    <svg
      className={`cube ${latest ? "latest" : ""} ${pending ? "pending" : ""}`}
      viewBox="0 0 170 175"
      aria-hidden="true"
    >
      <path className="cube-top" d="M85 8 158 47 85 87 12 47Z" />
      <path className="cube-left" d="M12 47 85 87v78l-73-40Z" />
      <path className="cube-right" d="M85 87 158 47v78l-73 40Z" />
      <path
        className="cube-grid"
        d="m37 34 73 40M61 21l73 40M37 61l73-40M61 74l73-40M36 61v77M61 74v77M109 74v78M134 61v78M12 73l73 39 73-39M12 99l73 39 73-39"
      />
      <text x="85" y="54" textAnchor="middle" className="cube-symbol">
        {pending ? "?" : latest ? "₿" : "✓"}
      </text>
      <text
        x="49"
        y="114"
        textAnchor="middle"
        transform="rotate(28 49 114)"
        className="cube-height"
      >
        {block ? fmt(block.height) : "NEXT"}
      </text>
    </svg>
  );
}
export default function Countdown() {
  const [snapshot, setSnapshot] = useState<ChainSnapshot | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const [status, setStatus] = useState<
    "connecting" | "live" | "stale" | "offline"
  >("connecting");
  const [sound, setSound] = useState(false);
  const [drop, setDrop] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const [watch, setWatch] = useState(false);
  const lastBlock = useRef<Block | null>(null);
  const soundRef = useRef(false);
  const busy = useRef(false);
  const audio = useRef<AudioContext | null>(null);
  const mounted = useRef(true);
  const playImpact = useCallback(() => {
    if (!soundRef.current || !audio.current) return;
    const context = audio.current;
    void context
      .resume()
      .then(() => {
        const osc = context.createOscillator(),
          gain = context.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(135, context.currentTime);
        osc.frequency.exponentialRampToValueAtTime(
          38,
          context.currentTime + 0.25,
        );
        gain.gain.setValueAtTime(0.25, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(
          0.001,
          context.currentTime + 0.4,
        );
        osc.connect(gain);
        gain.connect(context.destination);
        osc.start();
        osc.stop(context.currentTime + 0.42);
      })
      .catch(() => {});
  }, []);
  const impact = useCallback(() => {
    setDrop((d) => d + 1);
    playImpact();
  }, [playImpact]);
  const refresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const response = await fetch("/api/chain", {
        cache: "no-store",
        signal: AbortSignal.timeout(18000),
      });
      if (!response.ok) throw new Error("Chain unavailable");
      const next: ChainSnapshot = await response.json();
      if (!mounted.current) return;
      const tip = next.blocks[0];
      if (lastBlock.current && tip.id !== lastBlock.current.id) {
        const advance = tip.height - lastBlock.current.height;
        if (advance > 0) {
          impact();
          setAnnouncement(
            advance === 1
              ? `Block ${fmt(tip.height)} just landed.`
              : `${fmt(advance)} new blocks. Now at ${fmt(tip.height)}.`,
          );
        } else
          setAnnouncement("The active chain changed. Block data refreshed.");
      }
      lastBlock.current = tip;
      setSnapshot(next);
      setStatus(
        next.stale || Date.now() - next.fetchedAt > 90000 ? "stale" : "live",
      );
    } catch {
      if (mounted.current) setStatus(lastBlock.current ? "stale" : "offline");
    } finally {
      busy.current = false;
    }
  }, [impact]);
  useEffect(() => {
    mounted.current = true;
    queueMicrotask(() => {
      if (mounted.current) {
        setNow(Date.now());
        void refresh();
      }
    });
    track("page_view");
    const clock = setInterval(() => setNow(Date.now()), 1000);
    const poll = setInterval(() => {
      if (!document.hidden) void refresh();
    }, 30000);
    const visible = () => {
      if (!document.hidden) void refresh();
    };
    const engaged = setTimeout(() => {
      if (!document.hidden) track("engaged_30s");
    }, 30000);
    const lingering = setTimeout(() => {
      if (!document.hidden) track("engaged_120s");
    }, 120000);
    document.addEventListener("visibilitychange", visible);
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setWatch(false);
    };
    document.addEventListener("keydown", escape);
    return () => {
      mounted.current = false;
      clearInterval(clock);
      clearInterval(poll);
      clearTimeout(engaged);
      clearTimeout(lingering);
      document.removeEventListener("visibilitychange", visible);
      document.removeEventListener("keydown", escape);
    };
  }, [refresh]);
  useEffect(() => {
    if (!announcement) return;
    const t = setTimeout(() => setAnnouncement(""), 9000);
    return () => clearTimeout(t);
  }, [announcement]);
  const tip = snapshot?.blocks[0];
  const remaining = tip ? blocksRemaining(tip.height) : null;
  const arrived = tip ? tip.height >= TARGET : false;
  const eta = tip ? estimateArrival(tip) : null;
  const seconds =
    eta && now ? Math.max(0, Math.floor((eta - now) / 1000)) : null;
  const times =
    seconds === null
      ? ["—", "—", "—", "—"]
      : [
          fmt(Math.floor(seconds / 86400)),
          pad(Math.floor(seconds / 3600) % 24),
          pad(Math.floor(seconds / 60) % 60),
          pad(seconds % 60),
        ];
  const age =
    tip && now
      ? Math.max(0, Math.floor((now / 1000 - tip.timestamp) / 60))
      : null;
  const estimateElapsed = !!eta && !!now && now >= eta && !arrived;
  const etaDate = eta
    ? new Date(eta).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      })
    : "Waiting for the chain";
  const observedSeconds =
    snapshot && snapshot.blocks.length > 1
      ? (snapshot.blocks[0].timestamp - snapshot.blocks.at(-1)!.timestamp) /
        (snapshot.blocks.length - 1)
      : null;
  async function share() {
    const data = {
      title: "HEIGHT MILLION",
      text: arrived
        ? "Bitcoin reached block 1,000,000. One chain. A million blocks. Be part of it."
        : remaining === null
          ? "One chain. One million blocks. Join the Bitcoin countdown."
          : `${fmt(remaining)} blocks to Bitcoin block 1,000,000. Every block brings us closer.`,
      url: location.origin,
    };
    try {
      if (navigator.share) await navigator.share(data);
      else {
        await navigator.clipboard.writeText(`${data.text} ${data.url}`);
        toast("Countdown link copied. Send it to your people.");
      }
      track("share");
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError"))
        toast("Copy the address from your browser to share the countdown.");
    }
  }
  function toggleSound() {
    const next = !sound;
    if (next) {
      try {
        audio.current ||= new AudioContext();
        void audio.current.resume();
      } catch {
        toast("Sound is unavailable in this browser.");
        return;
      }
      track("sound_on");
    }
    soundRef.current = next;
    setSound(next);
  }
  const liveLabel =
    status === "live" && snapshot && now && now - snapshot.fetchedAt <= 90000
      ? age !== null && age >= 120
        ? "FEED CHECKED · WAITING FOR A BLOCK"
        : "MAINNET · LIVE"
      : status === "connecting"
        ? "CONNECTING TO MAINNET"
        : status === "offline"
          ? "CONNECTION UNAVAILABLE"
          : "LAST KNOWN DATA";
  return (
    <div
      className={`site ${watch ? "watch-mode" : ""} ${arrived ? "million-reached" : ""}`}
    >
      <a href="#countdown" className="skip-link">
        Skip to countdown
      </a>
      <header className="header shell">
        <Link className="brand" href="/" aria-label="Height Million home">
          <Image unoptimized src="/favicon.svg" width="32" height="32" alt="" />
          <span>
            HEIGHT<span className="brand-light">MILLION</span>
          </span>
        </Link>
        <nav aria-label="Main navigation">
          <a href="#the-journey">The journey</a>
          <a href="#block-parties">Block parties</a>
          <a
            href={repo}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Source code on GitHub"
          >
            <Code size={18} />
          </a>
        </nav>
        <button className="share-top" onClick={share}>
          Share the countdown <Share2 size={15} />
        </button>
      </header>
      <main>
        <section
          className="mission shell"
          id="countdown"
          aria-labelledby="main-title"
        >
          <div className="mission-top">
            <span
              className={`live-status ${liveLabel.includes("LIVE") ? "is-live" : ""}`}
            >
              <span />
              {liveLabel}
            </span>
            <span className="mission-code">
              EST. 2009 &nbsp; / &nbsp; NEVER STOPPED
            </span>
          </div>
          <div className="eyebrow">ONE CHAIN. ONE MILLION BLOCKS.</div>
          <h1 id="main-title">
            <span className="sr-only">Bitcoin block </span>
            <span className="target-number">
              1,000,000<span className="target-dot">.</span>
            </span>
            <span className="sr-only"> countdown</span>
          </h1>
          <div className="hero-bottom">
            <p>
              {arrived
                ? "A million blocks. And we’re just getting started."
                : "No opening bell. No closing time.\nJust the next block."}
            </p>
            <div className="remaining">
              <span className="remaining-number">
                {remaining === null ? "—" : fmt(remaining)}
              </span>
              <span>BLOCKS TO GO</span>
            </div>
          </div>
          <div className="countdown-band">
            <div
              className="clock"
              aria-label={
                seconds === null
                  ? "Loading estimated time remaining"
                  : `Estimated ${times[0]} days, ${times[1]} hours, ${times[2]} minutes remaining`
              }
            >
              {times.map((time, i) => (
                <div className="time-unit" key={i}>
                  <span className="time-number">{arrived ? "00" : time}</span>
                  <span className="time-label">
                    {["DAYS", "HOURS", "MINUTES", "SECONDS"][i]}
                  </span>
                </div>
              ))}
            </div>
            <div className="arrival">
              <span className="label">
                {arrived
                  ? "MILESTONE REACHED"
                  : estimateElapsed
                    ? "ESTIMATE ELAPSED · WAITING FOR THE BLOCK"
                    : "ESTIMATED ARRIVAL"}
              </span>
              <strong>{arrived ? "Welcome to one million." : etaDate}</strong>
              <span>
                Based on 10-minute blocks · UTC{" "}
                <a
                  href="#how-it-works"
                  aria-label="How the arrival estimate works"
                >
                  ⓘ
                </a>
              </span>
            </div>
          </div>
          <div className="chain-stage" key={drop}>
            <div className="stage-heading">
              <span>
                <Radio size={14} /> THE CHAIN KEEPS MOVING
              </span>
              <span>
                {tip ? `LATEST #${fmt(tip.height)}` : "AWAITING FIRST BLOCK"}
              </span>
            </div>
            <div className={`block-train ${drop > 0 ? "impact" : ""}`}>
              {(snapshot
                ? snapshot.blocks.slice(0, 5).reverse()
                : Array.from({ length: 5 }, () => undefined)
              ).map((block, i) => (
                <a
                  className={`block-slot ${i === 4 ? "newest" : ""}`}
                  key={block?.id ?? i}
                  href={
                    block
                      ? `https://mempool.space/block/${block.id}`
                      : undefined
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={
                    block
                      ? `Explore block ${fmt(block.height)}, ${fmt(block.tx_count)} transactions`
                      : undefined
                  }
                  onClick={() => block && track("explorer_click")}
                >
                  <Cube block={block} latest={i === 4} />
                  <span className="block-caption">
                    {block ? `${fmt(block.tx_count)} txs` : "Syncing…"}
                  </span>
                  {i === 4 && <span className="latest-tag">LATEST BLOCK</span>}
                </a>
              ))}
              <div className="next-slot">
                <Cube pending />
                <span className="block-caption">NEXT UP</span>
              </div>
            </div>
            <div className="stage-floor" />
            <div className="stage-controls">
              <span className="block-announcement" role="status">
                {announcement ||
                  (age !== null
                    ? `Last block landed ${age < 1 ? "less than a minute" : `${fmt(age)} min`} ago`
                    : "Every new block gets an entrance.")}
              </span>
              <div>
                <button
                  onClick={() => {
                    impact();
                    track("replay_block");
                    toast(
                      "Block-drop preview. Live chain data stays unchanged.",
                    );
                  }}
                >
                  <RotateCcw size={14} /> Preview drop
                </button>
                <button
                  onClick={toggleSound}
                  aria-label={
                    sound ? "Turn impact sound off" : "Turn impact sound on"
                  }
                  aria-pressed={sound}
                >
                  {sound ? <Volume2 size={16} /> : <VolumeX size={16} />}
                  <span className="control-text">
                    Sound {sound ? "on" : "off"}
                  </span>
                </button>
                <button
                  onClick={() => {
                    setWatch(!watch);
                    if (!watch) track("watch_mode");
                  }}
                  aria-label={watch ? "Exit watch mode" : "Enter watch mode"}
                  aria-pressed={watch}
                >
                  {watch ? <X size={16} /> : <Expand size={16} />}
                </button>
              </div>
            </div>
          </div>
          <div className="progress-label">
            <span>THE ROAD TO A MILLION</span>
            <strong>
              {tip
                ? `${Math.min(100, (tip.height / TARGET) * 100).toFixed(4)}%`
                : "—"}
            </strong>
          </div>
          <Progress
            className="chain-progress"
            value={tip ? Math.min(100, (tip.height / TARGET) * 100) : 0}
            aria-label="Progress to block one million"
          />
          <div className="network-stats">
            <div>
              <span className="label">CURRENT HEIGHT</span>
              <strong>
                {tip ? fmt(tip.height) : "—"}
                <span> blocks</span>
              </strong>
            </div>
            <div>
              <span className="label">BLOCK SUBSIDY</span>
              <strong>
                {tip ? subsidy(tip.height) : "—"}
                <span> BTC</span>
              </strong>
            </div>
            <div>
              <span className="label">RECENT BLOCK PACE</span>
              <strong>
                {observedSeconds && observedSeconds > 0
                  ? (observedSeconds / 60).toFixed(1)
                  : "—"}
                <span> min / block</span>
              </strong>
              <small>
                Latest {snapshot ? snapshot.blocks.length - 1 : "—"} intervals ·
                varies
              </small>
            </div>
            <div>
              <span className="label">UNTIL NEXT HALVING</span>
              <strong>
                {tip
                  ? fmt(
                      (Math.floor(tip.height / 210000) + 1) * 210000 -
                        tip.height,
                    )
                  : "—"}
                <span> blocks</span>
              </strong>
            </div>
          </div>
          {(status === "offline" || status === "stale") && (
            <div className="connection-note">
              {snapshot
                ? "Live refresh is temporarily unavailable. Displaying the last known chain."
                : "We couldn’t reach a Bitcoin data provider. The countdown will appear when the connection returns."}{" "}
              <button onClick={() => void refresh()}>Retry now</button>
            </div>
          )}
        </section>
        <div className="ticker" aria-hidden="true">
          <span>STILL EARLY.</span>
          <span>BLOCK BY BLOCK.</span>
          <span>DON’T TRUST. VERIFY.</span>
          <span>STILL EARLY.</span>
          <span>BLOCK BY BLOCK.</span>
        </div>
        <section id="the-journey" className="journey shell content-section">
          <div className="section-title">
            <div>
              <span className="eyebrow">01 / PROOF OF TIME</span>
              <h2>
                A million blocks.
                <br />
                <span>Zero permission.</span>
              </h2>
            </div>
            <p>
              From a message in the genesis block to a global monetary network.
              The history is written in blocks.
            </p>
          </div>
          <div className="timeline">
            {[
              [
                "000,000",
                "2009",
                "The genesis block",
                "One block. A new beginning.",
              ],
              [
                "210,000",
                "2012",
                "The first halving",
                "The issuance rhythm begins.",
              ],
              [
                "840,000",
                "2024",
                "The fourth halving",
                "3.125 BTC. Same rules.",
              ],
              [
                "1,000,000",
                arrived ? "MILESTONE REACHED" : "UP NEXT",
                "The million club",
                "A milestone for everyone.",
              ],
              [
                "1,050,000",
                "AFTER THAT",
                "The fifth halving",
                "1.5625 BTC per block.",
              ],
            ].map(([height, year, title, desc], i) => (
              <article
                className={`milestone ${i === 3 ? "featured" : ""}`}
                key={height}
              >
                <span className="timeline-point" />
                <span className="milestone-year">{year}</span>
                <strong className="milestone-height">{height}</strong>
                <h3>{title}</h3>
                <p>{desc}</p>
              </article>
            ))}
          </div>
        </section>
        <section id="block-parties" className="parties shell content-section">
          <div className="section-title">
            <div>
              <span className="eyebrow">02 / DON’T CELEBRATE ALONE</span>
              <h2>
                Find your block party<span className="orange">.</span>
              </h2>
            </div>
            <a
              className="text-link"
              href={`${repo}/issues/new?template=block-party.yml`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => track("submit_party")}
            >
              Submit a gathering{" "}
            </a>
          </div>
          <div className="party-grid">
            <a
              className="party-card main-party"
              href="https://www.meetup.com/bitcoin-district/events/310457850/"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => track("party_click")}
            >
              <div className="card-top">
                <span className="tag">ORGANIZER LISTING</span>
                <MapPin size={24} />
              </div>
              <div className="party-art" aria-hidden="true">
                ₿<span>1M</span>
              </div>
              <span className="label">BITCOIN DISTRICT</span>
              <h3>
                Bitcoin Block
                <br />
                1,000,000 Party
              </h3>
              <p>
                May 1, 2027 · 10:30 AM–12:30 PM EDT
                <br />
                Venue to be announced
              </p>
              <span className="card-link">See organizer’s latest details</span>
            </a>
            <div className="community-card">
              <span className="tag">MAKE IT LOCAL</span>
              <h3>
                Same block.
                <br />
                Your people.
              </h3>
              <p>
                No million-block event nearby? Find your local Bitcoin community
                and give them a reason to get together.
              </p>
              <a
                href="https://btcmap.org/communities"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => track("community_click")}
              >
                Find communities on BTC Map{" "}
              </a>
              <a
                href="https://bitcoin.org/en/community"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => track("community_click")}
              >
                Explore Bitcoin meetups{" "}
              </a>
              <small>
                Community directories, not confirmed million-block events.
              </small>
            </div>
          </div>
          <p className="party-note">
            Party details checked October 8, 2026. Dates and venues may change.
            An event’s listed date is not a prediction of when the block will be
            mined. Always confirm with the organizer.
          </p>
        </section>
        <section
          id="how-it-works"
          className="faq-section shell content-section"
        >
          <div>
            <span className="eyebrow">03 / DON’T TRUST. VERIFY.</span>
            <h2>
              Big number.
              <br />A few small details.
            </h2>
            <p>
              This is an independent celebration of Bitcoin.
              <br />
              No tokens. No price predictions. Just blocks.
            </p>
          </div>
          <Accordion type="multiple" className="faq-list">
            {faq.map(([question, answer]) => (
              <AccordionItem value={question} key={question}>
                <AccordionTrigger>{question}</AccordionTrigger>
                <AccordionContent forceMount>
                  <p>{answer}</p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
        <section className="closing shell">
          <span className="eyebrow">YOU’LL REMEMBER WHERE YOU WERE.</span>
          <h2>
            {arrived ? "We made it to " : "See you at "}
            <span>1,000,000.</span>
          </h2>
          <button className="primary-button" onClick={share}>
            Bring someone to the countdown <Copy size={17} />
          </button>
        </section>
      </main>
      <footer className="footer shell">
        <Link className="brand" href="/">
          <Image unoptimized src="/favicon.svg" width="26" height="26" alt="" />
          <span>
            HEIGHT<span className="brand-light">MILLION</span>
          </span>
        </Link>
        <p>Built for the next block. Open source. Always.</p>
        <div>
          <a
            href={`https://${snapshot?.source || "mempool.space"}/`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track("source_click")}
          >
            Data: {snapshot?.source || "mempool.space"}
          </a>
          <a href={repo} target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
          <a href="/privacy">Privacy</a>
        </div>
      </footer>
      <Toaster
        theme="dark"
        position="bottom-center"
        toastOptions={{
          duration: 4500,
          style: {
            background: "#262c21",
            color: "#dde7d4",
            border: "1px solid #68795b",
            fontSize: "14px",
          },
        }}
      />
    </div>
  );
}
