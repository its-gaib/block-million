import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import Link from "next/link";
import type { Metadata } from "next";
import {
  getChatGPTUser,
  chatGPTSignInPath,
  chatGPTSignOutPath,
} from "@/app/chatgpt-auth";
import { isOwner } from "@/lib/owner";
import { getDatabase } from "@/db";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Private analytics | HEIGHT MILLION",
  robots: { index: false, follow: false },
  alternates: { canonical: "/admin" },
};
const labels: Record<string, string> = {
  page_view: "Page views",
  replay_block: "Block-drop previews",
  share: "Shares",
  party_click: "Party listing visits",
  community_click: "Community directory visits",
  explorer_click: "Block explorer visits",
  sound_on: "Sound enabled",
  watch_mode: "Watch mode opens",
  submit_party: "Submit party clicks",
  source_click: "Data source clicks",
  engaged_30s: "Stayed 30 seconds",
  engaged_120s: "Stayed 2 minutes",
};
async function readAnalytics() {
  try {
    const db = getDatabase();
    const since = new Date(Date.now() - 29 * 86400000)
      .toISOString()
      .slice(0, 10);
    const [summary, daily, actions, sources] = await Promise.all([
      db
        .prepare(
          "SELECT COALESCE(SUM(CASE WHEN event = 'page_view' THEN count ELSE 0 END),0) views, COUNT(DISTINCT CASE WHEN event = 'page_view' THEN day || session END) sessions, COALESCE(SUM(CASE WHEN event != 'page_view' THEN count ELSE 0 END),0) actions FROM daily_events WHERE day >= ?",
        )
        .bind(since)
        .first<{ views: number; sessions: number; actions: number }>(),
      db
        .prepare(
          "SELECT day, SUM(count) views, COUNT(DISTINCT session) sessions FROM daily_events WHERE event = 'page_view' AND day >= ? GROUP BY day ORDER BY day",
        )
        .bind(since)
        .all<{ day: string; views: number; sessions: number }>(),
      db
        .prepare(
          "SELECT event, SUM(count) total FROM daily_events WHERE day >= ? GROUP BY event ORDER BY total DESC",
        )
        .bind(since)
        .all<{ event: string; total: number }>(),
      db
        .prepare(
          "SELECT source, device, SUM(count) views FROM daily_events WHERE event = 'page_view' AND day >= ? GROUP BY source, device ORDER BY views DESC",
        )
        .bind(since)
        .all<{ source: string; device: string; views: number }>(),
    ]);
    return { summary, daily, actions, sources };
  } catch {
    return null;
  }
}
export default async function Admin() {
  const user = await getChatGPTUser();
  if (!user)
    return (
      <main className="document">
        <Link href="/">HEIGHT MILLION</Link>
        <h1>Private analytics</h1>
        <p>
          Visitor counts and what people do on the countdown. Only the site
          owner can see this dashboard.
        </p>
        <a
          className="primary-button"
          href={chatGPTSignInPath("/admin")}
          target="_top"
        >
          Sign in with ChatGPT
        </a>
      </main>
    );
  if (!(await isOwner()))
    return (
      <main className="document">
        <Link href="/">Back to countdown</Link>
        <h1>Owner access only</h1>
        <p>This account does not have access to the analytics dashboard.</p>
        <a href={chatGPTSignOutPath("/admin")} target="_top">
          Sign out and use the owner account
        </a>
      </main>
    );
  const analytics = await readAnalytics();
  if (!analytics)
    return (
      <main className="document">
        <Link href="/">Back to countdown</Link>
        <h1>Analytics temporarily unavailable</h1>
        <p>
          The countdown is still running. Reload this dashboard in a moment to
          try again.
        </p>
        <a href="/admin">Retry</a>
      </main>
    );
  const { summary, daily, actions, sources } = analytics;
  const max = Math.max(1, ...daily.results.map((row) => row.views));
  return (
    <main className="document">
      <Link href="/">HEIGHT MILLION / COUNTDOWN</Link>
      <h1>Behind the countdown.</h1>
      <p>
        Last 30 UTC days · Owner-only analytics · <a href="/admin">Refresh</a>
      </p>
      <div className="dashboard-grid">
        <div className="dashboard-stat">
          <strong>{summary?.views.toLocaleString() || "0"}</strong>
          <span>Page views</span>
        </div>
        <div className="dashboard-stat">
          <strong>{summary?.sessions.toLocaleString() || "0"}</strong>
          <span>Daily browser sessions</span>
        </div>
        <div className="dashboard-stat">
          <strong>{summary?.actions.toLocaleString() || "0"}</strong>
          <span>Interactions & engagement</span>
        </div>
      </div>
      <h2>Traffic by day</h2>
      {daily.results.length ? (
        <>
          <div className="analytics-bars" aria-hidden="true">
            {daily.results.map((row) => (
              <div
                className="analytics-bar"
                key={row.day}
                style={{ height: `${(row.views / max) * 100}%` }}
                data-label={`${row.day}: ${row.views} views`}
              />
            ))}
          </div>
          <Table className="analytics-table">
            <TableHeader>
              <TableRow>
                <TableHead>Date (UTC)</TableHead>
                <TableHead>Views</TableHead>
                <TableHead>Sessions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {daily.results.map((row) => (
                <TableRow key={row.day}>
                  <TableCell>{row.day}</TableCell>
                  <TableCell>{row.views}</TableCell>
                  <TableCell>{row.sessions}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      ) : (
        <p>
          No visits recorded yet. The counters will appear as visitors arrive.
        </p>
      )}
      <h2>What visitors do</h2>
      <Table className="analytics-table">
        <TableHeader>
          <TableRow>
            <TableHead>Action</TableHead>
            <TableHead>Count</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {actions.results.map((row) => (
            <TableRow key={row.event}>
              <TableCell>{labels[row.event] || row.event}</TableCell>
              <TableCell>{row.total}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <h2>Where visits come from</h2>
      <Table className="analytics-table">
        <TableHeader>
          <TableRow>
            <TableHead>Source category</TableHead>
            <TableHead>Screen size</TableHead>
            <TableHead>Views</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sources.results.map((row) => (
            <TableRow key={row.source + row.device}>
              <TableCell>{row.source}</TableCell>
              <TableCell>{row.device}</TableCell>
              <TableCell>{row.views}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <h2>How to read these numbers</h2>
      <p>
        Sessions are anonymous browser tabs per UTC day, not identified people.
        One person can have several sessions. Repeat actions are capped at 30
        per session per day. We exclude common bots and honor Do Not Track and
        Global Privacy Control. Blockers, disabled JavaScript and failed
        requests can reduce counts. Engagement means the tab was visible at the
        30-second or two-minute check.
      </p>
      <p>
        We store no IP addresses, full URLs, emails or fingerprints in
        analytics. Records are retained for approximately 90 days and purged as
        new events arrive.
      </p>
      <p>
        <a href={chatGPTSignOutPath("/")} target="_top">
          Sign out
        </a>
      </p>
    </main>
  );
}
