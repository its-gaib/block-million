const LEGACY_HOSTNAME = "heightmillion.pages.dev";
const CANONICAL_ORIGIN = "https://blockmillion.pages.dev";

function plain(request, status, message, extraHeaders = {}) {
  return new Response(request.method === "HEAD" ? null : message, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders,
    },
  });
}

export default {
  fetch(request) {
    const incoming = new URL(request.url);
    if (incoming.hostname !== LEGACY_HOSTNAME)
      return plain(request, 404, "Not found.");

    let pathname;
    try {
      pathname = decodeURIComponent(incoming.pathname);
    } catch {
      return plain(request, 400, "Invalid path.");
    }
    if (/^\/api(?:\/|$)/i.test(pathname))
      return plain(request, 410, "This API has moved to blockmillion.pages.dev.");
    if (request.method !== "GET" && request.method !== "HEAD")
      return plain(request, 405, "Method not allowed.", { Allow: "GET, HEAD" });

    // Set the path on a fixed origin. URL resolution against a supplied path
    // would let paths beginning with // select a different destination host.
    const destination = new URL(CANONICAL_ORIGIN);
    destination.pathname = incoming.pathname;
    destination.search = incoming.search;
    return new Response(null, {
      status: 308,
      headers: {
        Location: destination.href,
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
      },
    });
  },
};
