import { loadNetworkSnapshot } from "@/lib/network";

export async function GET() {
  const snapshot = await loadNetworkSnapshot();
  const incomplete = Object.values(snapshot).some(
    (resource) => resource === null || resource.stale,
  );
  return Response.json(snapshot, {
    headers: {
      "Cache-Control": incomplete
        ? "no-store"
        : "public, max-age=30, s-maxage=60",
    },
  });
}
