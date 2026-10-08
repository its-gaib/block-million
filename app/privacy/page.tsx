import Link from "next/link";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Privacy | HEIGHT MILLION",
  alternates: { canonical: "/privacy" },
};
export default function Privacy() {
  return (
    <main className="document">
      <Link href="/">Back to HEIGHT MILLION</Link>
      <h1>
        Just blocks.
        <br />
        No following you around.
      </h1>
      <p>
        HEIGHT MILLION is an independent, open-source Bitcoin countdown. Here is
        what happens when you visit.
      </p>
      <h2>Simple first-party analytics</h2>
      <p>
        We count page views and a small set of actions: shares, block-drop
        previews, sound enabled, watch mode, external link clicks, and whether
        the tab is visible after 30 seconds or two minutes. We record the UTC
        day, a broad source category (such as search, social or direct), and
        mobile or desktop screen size.
      </p>
      <p>
        A random identifier in session storage distinguishes browser-tab
        sessions. It is not a cross-site tracking ID and is not designed to
        identify a person. It normally disappears when the tab closes, although
        browser session restore may preserve it. Counts are grouped by day and
        action. Records are retained for approximately 90 days and removed as
        new visits arrive.
      </p>
      <p>
        We do not persist IP addresses, full referring URLs, search terms,
        user-agent strings, emails, precise locations or fingerprints in the
        analytics database. The server briefly uses the connection’s IP address
        in memory to limit abusive requests. The private dashboard is available
        only to the owner.
      </p>
      <h2>Your choice</h2>
      <p>
        Enable Do Not Track or Global Privacy Control in your browser and the
        site will skip analytics requests. Blocking scripts also prevents these
        analytics. The countdown does not depend on tracking.
      </p>
      <h2>Live Bitcoin data</h2>
      <p>
        Your browser requests block data from this site. Our server retrieves it
        from mempool.space or Blockstream. We do not send your session
        identifier to either provider. Following an external link takes you to
        that service, which has its own privacy practices.
      </p>
      <h2>Hosting and access</h2>
      <p>
        The site runs on Cloudflare Pages. The hosting provider may
        process ordinary connection data needed to serve and protect the site
        under its own policies. The owner’s private dashboard is protected by a
        browser password prompt. Public visitors do not need an account, and
        the site does not offer public registration.
      </p>
      <h2>Questions or fixes</h2>
      <p>
        <a
          href="https://github.com/its-gaib/height-million/issues"
          target="_blank"
          rel="noopener noreferrer"
        >
          Open an issue on GitHub
        </a>
        . Do not include private personal information in a public issue.
      </p>
      <p>Last updated October 8, 2026.</p>
    </main>
  );
}
