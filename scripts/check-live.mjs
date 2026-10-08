import assert from "node:assert/strict";
const origin = "https://heightmillion.pages.dev";
async function read(path, options) {
  const response = await fetch(new URL(path, origin), {
    ...options,
    signal: AbortSignal.timeout(20000),
    redirect: "error",
  });
  return { response, body: await response.text() };
}
async function check() {
  const home = await read("/");
  assert.equal(home.response.status, 200, "Homepage must return 200");
  assert.ok(
    home.body.includes("1,000,000") && home.body.includes(origin),
    "Homepage and canonical metadata must be present",
  );
  const assets = [
    ...new Set(
      [...home.body.matchAll(/(?:src|href)="([^"<>]+)"/g)]
        .map((match) => match[1])
        .filter((url) => url.startsWith("/_next/static/")),
    ),
  ];
  assert.ok(assets.length > 0, "Client assets must be referenced");
  await Promise.all(
    assets.map(async (path) => {
      const { response } = await read(path);
      assert.equal(response.status, 200, `Asset missing: ${path}`);
    }),
  );
  for (const path of [
    "/privacy",
    "/robots.txt",
    "/sitemap.xml",
    "/favicon.svg",
    "/2b5c16277262e651dcf8aa731661a9ae.txt",
  ]) {
    const { response } = await read(path);
    assert.equal(response.status, 200, `Public route missing: ${path}`);
  }
  const chain = await read("/api/chain");
  assert.equal(chain.response.status, 200, "Live chain feed must respond");
  const snapshot = JSON.parse(chain.body);
  assert.ok(
    Number.isSafeInteger(snapshot.blocks?.[0]?.height) &&
      snapshot.blocks[0].height > 900000,
    "Chain feed must contain a valid block height",
  );
  assert.ok(
    !snapshot.stale && Date.now() - snapshot.fetchedAt < 120000,
    "Chain feed must be fresh",
  );
  for (const headers of [
    {},
    {
      "oai-authenticated-user-id": "forged",
      "oai-authenticated-user-email": "forged@example.com",
    },
    { Authorization: "Basic " + Buffer.from("owner:wrong").toString("base64") },
  ]) {
    const { response, body } = await read("/admin", { headers });
    assert.equal(
      response.status,
      401,
      "Private dashboard must reject unauthorized access",
    );
    assert.match(response.headers.get("cache-control") || "", /no-store/);
    assert.ok(
      !body.includes("Behind the countdown"),
      "Private statistics must not leak",
    );
  }
  console.log(
    `Live checks passed: ${origin} — homepage, ${assets.length} assets, public routes, fresh block ${snapshot.blocks[0].height}, and protected owner access.`,
  );
}
let failure;
for (let attempt = 1; attempt <= 6; attempt++) {
  try {
    await check();
    process.exit(0);
  } catch (error) {
    failure = error;
    if (attempt < 6) {
      console.log(
        `Live check attempt ${attempt} incomplete; retrying in five seconds.`,
      );
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}
console.error(
  failure instanceof Error ? failure.message : "Live site verification failed",
);
process.exit(1);
