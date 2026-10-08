import { getDatabase } from "@/db";
import { validEvent } from "@/lib/analytics";
// Best-effort per-isolate abuse protection; never persist network identifiers.
const buckets = new Map<string, { count: number; until: number }>();
function limited(ip: string) {
  const now = Date.now();
  const bucket = buckets.get(ip);
  if (bucket && bucket.until > now) return ++bucket.count > 90;
  if (buckets.size > 2000) {
    for (const [key, value] of buckets)
      if (value.until < now) buckets.delete(key);
    if (buckets.size > 2000) return true;
  }
  buckets.set(ip, { count: 1, until: now + 60000 });
  return false;
}
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (
    !origin ||
    origin !== new URL(request.url).origin ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    return new Response(null, { status: 403 });
  if (
    request.headers.get("dnt") === "1" ||
    request.headers.get("sec-gpc") === "1"
  )
    return new Response(null, { status: 204 });
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return new Response(null, { status: 415 });
  if (Number(request.headers.get("content-length") || 0) > 512)
    return new Response(null, { status: 413 });
  if (limited(request.headers.get("cf-connecting-ip") || "unknown"))
    return new Response(null, {
      status: 429,
      headers: { "Retry-After": "60" },
    });
  if (
    /bot|crawler|spider|headless/i.test(request.headers.get("user-agent") || "")
  )
    return new Response(null, { status: 204 });
  try {
    const reader = request.body?.getReader();
    if (!reader) return new Response(null, { status: 400 });
    let size = 0;
    const parts: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 512) {
        await reader.cancel();
        return new Response(null, { status: 413 });
      }
      parts.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const p of parts) {
      bytes.set(p, offset);
      offset += p.length;
    }
    const input: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!validEvent(input)) return new Response(null, { status: 400 });
    const day = new Date().toISOString().slice(0, 10);
    const db = getDatabase();
    const cap = input.event.startsWith("engaged_") ? 1 : 30;
    await db
      .prepare(
        `INSERT INTO daily_events(day, session, event, source, device, count) VALUES (?, ?, ?, ?, ?, 1)
      ON CONFLICT(day, session, event) DO UPDATE SET count = count + 1 WHERE count < ?`,
      )
      .bind(day, input.session, input.event, input.source, input.device, cap)
      .run();
    if (Math.random() < 0.02)
      await db
        .prepare("DELETE FROM daily_events WHERE day < ?")
        .bind(new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10))
        .run();
    return new Response(null, {
      status: 204,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof SyntaxError)
      return new Response(null, { status: 400 });
    console.error("Analytics write unavailable");
    return new Response(null, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
