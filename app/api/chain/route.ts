import { ChainSnapshot, validBlocks } from "@/lib/bitcoin";
let cached: ChainSnapshot | null = null;
let pending: Promise<ChainSnapshot> | null = null;
const providers = ["mempool.space", "blockstream.info"] as const;
async function readChain(): Promise<ChainSnapshot> {
  for (const source of providers) {
    try {
      const response = await fetch(`https://${source}/api/blocks`, {
        signal: AbortSignal.timeout(6500),
        redirect: "manual",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) continue;
      if (Number(response.headers.get("content-length") || 0) > 65536) continue;
      const reader = response.body?.getReader();
      if (!reader) continue;
      let size = 0;
      const chunks: Uint8Array[] = [];
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 65536) {
          await reader.cancel();
          throw new Error("Response too large");
        }
        chunks.push(value);
      }
      const body = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        body.set(chunk, offset);
        offset += chunk.length;
      }
      const blocks: unknown = JSON.parse(new TextDecoder().decode(body));
      if (!validBlocks(blocks)) continue;
      if (
        cached &&
        blocks[0].height < cached.blocks[0].height &&
        cached.blocks.some((block) => block.id === blocks[0].id)
      )
        continue;
      cached = { blocks, source, fetchedAt: Date.now() };
      return cached;
    } catch (error) {
      console.warn(
        "Bitcoin provider request failed",
        source,
        error instanceof Error ? error.message : "request error",
      );
    }
  }
  throw new Error("Bitcoin providers unavailable");
}
export async function GET() {
  try {
    if (cached && Date.now() - cached.fetchedAt < 20000)
      return Response.json(cached, {
        headers: { "Cache-Control": "public, max-age=10, s-maxage=20" },
      });
    pending ||= readChain().finally(() => {
      pending = null;
    });
    return Response.json(await pending, {
      headers: { "Cache-Control": "public, max-age=10, s-maxage=20" },
    });
  } catch {
    if (cached)
      return Response.json(
        { ...cached, stale: true },
        { headers: { "Cache-Control": "no-store" } },
      );
    return Response.json(
      { error: "Live chain data is temporarily unavailable." },
      {
        status: 503,
        headers: { "Cache-Control": "no-store", "Retry-After": "30" },
      },
    );
  }
}
