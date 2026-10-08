# HEIGHT MILLION

**One chain. One million blocks.** A live, open-source countdown to Bitcoin block height **1,000,000**.

[Visit HEIGHT MILLION](https://heightmillion.pages.dev) · [Suggest a block party](https://github.com/its-gaib/height-million/issues/new?template=block-party.yml)

## Every block brings us closer

- Live Bitcoin height, blocks remaining, and an estimated arrival time.
- New blocks drop into an original isometric chain, with optional sound and reduced-motion support.
- Focused watch mode and a block-drop preview to try the animation.
- Recent block pace, mining subsidy, milestone history, and halving context.
- Community links and block-million party listings.

Bitcoin data comes from [mempool.space](https://mempool.space), with [Blockstream](https://blockstream.info) as a fallback. The site checks for new blocks every 30 seconds while the tab is visible and labels stale data when a refresh fails.

The countdown targets **block height 1,000,000**. Bitcoin's genesis block is height 0, so the chain will contain 1,000,001 blocks including genesis at this milestone. Blocks remaining are calculated from the current height. The time estimate adds Bitcoin's ten-minute target interval for each remaining block to the latest block's timestamp; actual arrival can be earlier or later.

Block 1,000,000 is not a halving. Its mining subsidy is **3.125 BTC**, plus transaction fees. The following halving occurs at height **1,050,000**.

## Run locally

Requires Node.js 22.13 or later and npm.

```sh
npm ci
npm run dev
```

Run the tests and build for Cloudflare Pages:

```sh
npm test
npm run build:pages
```

## Join the million-block party

Organizing a celebration? [Submit a block party](https://github.com/its-gaib/height-million/issues/new?template=block-party.yml) with its location, organizer, date, and a public event link. Listings are reviewed before appearing on the site. A party's scheduled date is not a prediction of the exact time block 1,000,000 will be mined.

Ideas, fixes, and contributions are welcome through [GitHub issues](https://github.com/its-gaib/height-million/issues) and pull requests.

## License

Original application code is [MIT licensed](LICENSE). Vendored components and tooling retain their upstream notices. HEIGHT MILLION is an independent Bitcoin project, unaffiliated with mempool.space, Blockstream, Bitcoin Core, or listed event organizers. Its block artwork is original.
