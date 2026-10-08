import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { tmpdir } from "node:os";
const root = fileURLToPath(new URL("../", import.meta.url));
const { staging } = JSON.parse(
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
process.exit(result.status ?? 1);
