import { spawnSync } from "node:child_process";
import {
  cp,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
// A separate project directory avoids Cloudflare Vite's Workers-config redirect.
const gitHead = spawnSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
});
const gitStatus = spawnSync("git", ["status", "--porcelain"], {
  cwd: root,
  encoding: "utf8",
});
const sourceCommit =
  gitHead.status === 0 && gitStatus.status === 0 && !gitStatus.stdout.trim()
    ? gitHead.stdout.trim()
    : null;
const staging = await mkdtemp(path.join(tmpdir(), "blockmillion-pages-"));
const publicDir = path.join(staging, "public");
await cp(path.join(root, "dist/client"), publicDir, { recursive: true });
const workerDir = path.join(publicDir, "_worker.js");
async function copyModules(source, destination) {
  await mkdir(destination, { recursive: true });
  for (const entry of await readdir(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name),
      target = path.join(destination, entry.name);
    if (entry.isDirectory()) await copyModules(sourcePath, target);
    else if (/\.(?:m?js|wasm)$/.test(entry.name)) await cp(sourcePath, target);
  }
}
await copyModules(path.join(root, "dist/server"), workerDir);
await writeFile(
  path.join(staging, "wrangler.json"),
  await readFile(path.join(root, "pages.config.json")),
);
await writeFile(
  path.join(publicDir, "_routes.json"),
  JSON.stringify({
    version: 1,
    include: ["/*"],
    exclude: [
      "/_next/static/*",
      "/favicon.svg",
      "/2b5c16277262e651dcf8aa731661a9ae.txt",
    ],
  }),
);
await writeFile(
  path.join(publicDir, "_headers"),
  "/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  X-Frame-Options: DENY\n/_next/static/*\n  Cache-Control: public, max-age=31536000, immutable\n",
);
await mkdir(path.join(root, ".sites-runtime"), { recursive: true });
await writeFile(
  path.join(root, ".sites-runtime/pages-artifact.json"),
  JSON.stringify(
    { staging, publicDir, sourceCommit, generatedAt: new Date().toISOString() },
    null,
    2,
  ),
);
console.log(JSON.stringify({ staging, publicDir }));
