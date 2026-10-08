import assert from "node:assert/strict";
import test from "node:test";
import worker from "../build/legacy-redirect.mjs";

const legacy = "https://heightmillion.pages.dev";
const canonical = "https://blockmillion.pages.dev";
const get = (path, options) => worker.fetch(new Request(legacy + path, options));

test("legacy pages permanently redirect and preserve path and query", () => {
  for (const path of ["/", "/privacy", "/privacy?from=old&view=full"]) {
    const response = get(path);
    assert.equal(response.status, 308);
    assert.equal(response.headers.get("location"), canonical + path);
    assert.match(response.headers.get("cache-control"), /no-store/);
  }
});

test("host-like paths cannot select a different redirect origin", () => {
  for (const path of ["//evil.example/path", "/%2F%2Fevil.example", "/https://evil.example/"]) {
    const response = get(path);
    assert.equal(response.status, 308);
    assert.equal(new URL(response.headers.get("location")).origin, canonical);
  }
});

test("unexpected hosts fail closed rather than redirect", () => {
  for (const host of ["example.com", "heightmillion.pages.dev.evil.example", "preview.heightmillion.pages.dev"]) {
    const response = worker.fetch(new Request(`https://${host}/`));
    assert.equal(response.status, 404);
    assert.equal(response.headers.get("location"), null);
  }
});

test("legacy API reads and writes are retired without redirecting or proxying", () => {
  for (const path of ["/api", "/api/chain", "/api/events", "/%61pi/events", "/api%2fevents"]) {
    for (const method of ["GET", "POST", "PUT", "DELETE", "HEAD"]) {
      const response = get(path, { method });
      assert.equal(response.status, 410);
      assert.equal(response.headers.get("location"), null);
      assert.match(response.headers.get("cache-control"), /no-store/);
    }
  }
  const response = get("/privacy", { method: "POST" });
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "GET, HEAD");
});

test("owner navigation redirects without reproducing authorization", async () => {
  const response = get("/admin", {
    headers: { Authorization: "Basic sensitive-owner-credential" },
  });
  assert.equal(response.status, 308);
  assert.equal(response.headers.get("location"), `${canonical}/admin`);
  assert.equal(response.headers.get("authorization"), null);
  assert.equal(response.headers.get("www-authenticate"), null);
  assert.equal(await response.text(), "");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
});

test("HEAD redirects have no body and invalid paths fail closed", async () => {
  const response = get("/privacy", { method: "HEAD" });
  assert.equal(response.status, 308);
  assert.equal(await response.text(), "");
  assert.equal(get("/%zz").status, 400);
});
