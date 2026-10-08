import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const canonical = "https://blockmillion.pages.dev";
const legacy = "https://heightmillion.pages.dev";

async function read(origin, pathname, options = {}) {
  const response = await fetch(new URL(pathname, origin), {
    ...options,
    signal: AbortSignal.timeout(20000),
    redirect: "manual",
  });
  return { response, body: await response.text() };
}

async function verifyDestination() {
  const [home, chain, network, admin] = await Promise.all([
    read(canonical, "/"),
    read(canonical, "/api/chain"),
    read(canonical, "/api/network"),
    read(canonical, "/admin"),
  ]);
  assert.equal(home.response.status, 200, "New homepage must return 200");
  assert.ok(home.body.includes("BLOCK MILLION"), "New branding must be live");
  const canonicalTag = (home.body.match(/<link\b[^>]*>/g) || []).find((tag) =>
    /\brel="canonical"/.test(tag),
  );
  assert.ok(canonicalTag, "New homepage must contain canonical metadata");
  const canonicalHref = canonicalTag.match(/\bhref="([^"]+)"/)?.[1];
  assert.ok(canonicalHref, "Canonical metadata must contain a URL");
  assert.equal(new URL(canonicalHref).href, `${canonical}/`, "Canonical URL must use new host");
  assert.equal(chain.response.status, 200, "New chain API must return 200");
  const snapshot = JSON.parse(chain.body);
  assert.ok(
    Number.isSafeInteger(snapshot.blocks?.[0]?.height) &&
      snapshot.blocks[0].height > 900000,
    "New chain API must provide a valid block height",
  );
  assert.ok(
    !snapshot.stale &&
      Number.isFinite(snapshot.fetchedAt) &&
      Date.now() - snapshot.fetchedAt >= -60000 &&
      Date.now() - snapshot.fetchedAt < 120000,
    "New chain API must provide fresh data",
  );
  assert.equal(network.response.status, 200, "New network API must return 200");
  const networkSnapshot = JSON.parse(network.body);
  assert.ok(
    networkSnapshot && typeof networkSnapshot === "object" && !Array.isArray(networkSnapshot),
    "New network API must return JSON",
  );
  assert.equal(admin.response.status, 401, "New owner dashboard must be private");
  assert.match(admin.response.headers.get("cache-control") || "", /no-store/);
  console.log("New site is healthy; redirecting the legacy Pages project.");
}

async function verifyLegacy() {
  for (const pathname of ["/", "/privacy?from=legacy", "/admin"]) {
    const { response } = await read(legacy, pathname);
    assert.equal(response.status, 308, `Missing legacy redirect: ${pathname}`);
    assert.equal(response.headers.get("location"), canonical + pathname);
    assert.match(response.headers.get("cache-control") || "", /no-store/);
  }
  const { response } = await read(legacy, "/api/events", { method: "POST" });
  assert.equal(response.status, 410, "Legacy API writes must be retired");
  assert.equal(response.headers.get("location"), null);
  assert.match(response.headers.get("cache-control") || "", /no-store/);
  const { response: home } = await read(canonical, "/");
  assert.equal(home.status, 200, "New homepage must not redirect back");
}

// Do not change the existing host until its replacement has passed real checks.
await verifyDestination();
const staging = await mkdtemp(path.join(tmpdir(), "blockmillion-legacy-"));
try {
  const publicDir = path.join(staging, "public");
  await mkdir(publicDir);
  await copyFile(
    path.join(root, "build/legacy-redirect.mjs"),
    path.join(publicDir, "_worker.js"),
  );
  await writeFile(
    path.join(publicDir, "_routes.json"),
    JSON.stringify({ version: 1, include: ["/*"], exclude: [] }),
  );
  await writeFile(
    path.join(staging, "wrangler.json"),
    JSON.stringify({
      name: "heightmillion",
      pages_build_output_dir: "./public",
      compatibility_date: "2026-05-15",
      send_metrics: false,
    }),
  );
  const result = spawnSync(
    process.execPath,
    [
      path.join(root, "node_modules/wrangler/bin/wrangler.js"),
      "pages",
      "deploy",
      "public",
      "--project-name",
      "heightmillion",
      "--branch",
      "launch",
      "--no-bundle",
    ],
    {
      cwd: staging,
      stdio: "inherit",
      env: {
        ...process.env,
        CLOUDFLARE_ACCOUNT_ID: "40004c1e2f630c996ceaf76c198316ec",
        WRANGLER_SEND_METRICS: "false",
      },
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`Legacy deployment failed with status ${result.status}`);

  let failure;
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      await verifyLegacy();
      console.log(`Legacy redirect verified: ${legacy} → ${canonical}`);
      failure = undefined;
      break;
    } catch (error) {
      failure = error;
      if (attempt < 6) {
        console.log("Waiting five seconds for the legacy deployment to propagate.");
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  }
  if (failure) throw failure;
} finally {
  await rm(staging, { recursive: true, force: true });
}
