# HEIGHT MILLION

**One chain. One million blocks.** A live, open-source countdown to Bitcoin block height **1,000,000**.

[Website](https://height-million.frosty-okapi-1278.chatgpt.site) · [Private owner analytics](https://height-million.frosty-okapi-1278.chatgpt.site/admin) · [Suggest a block party](https://github.com/its-gaib/height-million/issues/new?template=block-party.yml)

## What it does

- Live height and remaining blocks, checked every 30 seconds while the tab is visible.
- An anchored time estimate using the latest block timestamp plus 600 seconds for each remaining block.
- An original isometric block visualization; new blocks drop into the chain with optional synthesized sound, reduced-motion support, and watch mode.
- A clearly labeled drop preview that never changes real Bitcoin data.
- Subsidy, recent block pace, halving context, milestone history, community directories and one verified organizer listing.
- First-party, privacy-conscious analytics and an owner-only dashboard.
- Server-rendered explanatory content, canonical metadata, sitemap, robots rules, and IndexNow verification.

This targets **height** 1,000,000. Genesis is height 0. This milestone is not a halving; its subsidy is 3.125 BTC plus fees. The following halving is at 1,050,000.

## Development

Requires Node 22.13+ and npm.

```sh
npm ci
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_overrated_lilandra.sql
npm run dev
```

Apply each local migration once. Local D1 lives in ignored `.wrangler/state`. Do not put real credentials in source. To test the owner dashboard with the starter's local sign-in, put `ANALYTICS_OWNER_EMAIL=seedy@sites.test` in ignored `.dev.vars`, then sign in using the local `/admin` page. This mock authentication exists only in the development server.

```sh
npm test
npx tsc --noEmit
npm run lint
npm run build
```

## Production

The Cloudflare-compatible Vinext Worker is deployed with OpenAI Sites. `.openai/hosting.json` declares the logical `DB` binding; Sites provisions D1 and applies the committed Drizzle migrations. Runtime secrets are configured in Sites, not the manifest. `ANALYTICS_OWNER_EMAIL` must exactly match the owner's authenticated ChatGPT email. Missing configuration denies dashboard access.

Sites dispatch owns sign-in and the trusted `oai-authenticated-user-*` headers. If migrating to standalone Cloudflare or another host, implement a verified identity boundary before exposing `/admin`; never expose this Worker directly to arbitrary callers with trusted auth headers. Local production previews bind only to loopback.

Production source is mirrored to this GitHub repository. For Sites publication use the installed Sites workflow to build, package, push source, save a version and deploy it. No GitHub Actions or external tracking account is required. The free provided address is sufficient for launch; no paid domain has been purchased. A custom domain can be attached later after purchase and DNS setup.

## Data and analytics

`/api/chain` calls fixed endpoints at [mempool.space](https://mempool.space/docs/api/rest) with [Blockstream Esplora](https://github.com/Blockstream/esplora/blob/master/API.md) as an independent fallback. It rejects malformed/disconnected chains, limits time and response size, shares short-lived cache within an isolate, and preserves stale data with an explicit status when upstreams fail. A lagging provider cannot replace a known descendant with its ancestor. A long block interval is not proof of an outage. An elapsed estimate does not trigger milestone celebration; only the actual observed height does.

`/api/events` accepts only a fixed event vocabulary and tiny same-origin JSON payloads. Analytics store UTC date, random per-tab session ID, event, broad source category, mobile/desktop class, and a capped count. No IP addresses, full referrer URLs, user-agent strings or fingerprints are persisted in the analytics database. IPs are used briefly in memory for best-effort per-isolate rate limiting; this is not a global anti-bot guarantee. Public analytics can be spoofed by determined clients. Counts are approximate and intended for simple product insight, not billing.

The dashboard shows 30 days. Records older than 90 days are removed opportunistically as events arrive. Do Not Track and Global Privacy Control suppress collection. Daily browser sessions are not unique people. OpenAI Sites may process connection data under its own hosting policies. See [privacy](https://height-million.frosty-okapi-1278.chatgpt.site/privacy).

## Content and discovery

Research references: [Bitcoin Block Half](https://www.bitcoinblockhalf.com/), [OpenBitcoin](https://openbitcoin.com/block-1m), [Bitcoin developer guide](https://developer.bitcoin.org/devguide/block_chain.html#block-height-and-forking), and [Bitcoin Core](https://github.com/bitcoin/bitcoin/blob/master/src/validation.cpp).

The [Bitcoin District party](https://www.meetup.com/bitcoin-district/events/310457850/) was listed for May 1, 2027, 10:30–12:30 EDT, venue TBD, when checked October 8, 2026. That listing is not a guaranteed block date. Community-directory links are not presented as confirmed events. New submissions arrive through GitHub issues and require review before adding to the site.

Search discovery is supported by indexable HTML, descriptive metadata, a sitemap, robots rules, and an IndexNow key. Search engines decide when and whether to index. To strengthen Google discovery, verify the live domain in Google Search Console and submit `/sitemap.xml`; the site does not claim guaranteed rankings or fabricate traffic. Social announcements can be posted from your own accounts when you choose.

## License

Original application code is MIT licensed. Vendored starter components and tooling retain their upstream notices. This is an independent Bitcoin project, not affiliated with mempool.space, Blockstream, Bitcoin District or Bitcoin Core. No third-party site code, artwork or videos were copied.
