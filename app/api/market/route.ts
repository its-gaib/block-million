import { loadMarketSnapshot } from "@/lib/market";

export async function GET() {
  const snapshot = await loadMarketSnapshot();
  const incomplete = Object.values(snapshot).some((resource) => resource === null || resource.stale);
  return Response.json(snapshot, {
    headers: { "Cache-Control": incomplete ? "no-store" : "public, max-age=30, s-maxage=60" },
  });
}
