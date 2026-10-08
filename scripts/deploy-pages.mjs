import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { tmpdir } from "node:os";
const root = fileURLToPath(new URL("../", import.meta.url));
const { staging, sourceCommit } = JSON.parse(
  await readFile(path.join(root, ".sites-runtime/pages-artifact.json"), "utf8"),
);
if (
  path.dirname(staging) !== tmpdir() ||
  !path.basename(staging).startsWith("heightmillion-pages-")
)
  throw new Error(
    "Unexpected Pages artifact directory. Run npm run build:pages first.",
  );
const head = spawnSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
});
if (head.status !== 0) throw new Error("Commit the source before deploying.");
const status = spawnSync("git", ["status", "--porcelain"], {
  cwd: root,
  encoding: "utf8",
});
if (
  status.status !== 0 ||
  status.stdout.trim() ||
  sourceCommit !== head.stdout.trim()
)
  throw new Error(
    "Source changed since the Pages build. Commit the work and run npm run build:pages again.",
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
    "--commit-hash",
    head.stdout.trim(),
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
if (result.status !== 0) process.exit(result.status ?? 1);
const checks = spawnSync(
  process.execPath,
  [path.join(root, "scripts/check-live.mjs")],
  { cwd: root, stdio: "inherit" },
);
if (checks.error) throw checks.error;
process.exit(checks.status ?? 1);
