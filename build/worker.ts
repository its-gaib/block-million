import handler from "vinext/server/fetch-handler";
import { verifyAdminAuthorization, adminChallenge } from "../lib/admin-auth";
export default {
  async fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    let path = url.pathname;
    try {
      path = decodeURIComponent(path);
    } catch {
      return new Response("Invalid URL", { status: 400 });
    }
    const isAdmin = path === "/admin" || path.startsWith("/admin/");
    if (
      isAdmin &&
      !(await verifyAdminAuthorization(
        request.headers.get("authorization"),
        env.ADMIN_CREDENTIAL_SHA256,
      ))
    )
      return adminChallenge();
    if (
      path.startsWith("/_next/static/") ||
      path === "/favicon.svg" ||
      /^\/[0-9a-f]{32}\.txt$/.test(path)
    ) {
      if (env.ASSETS) return env.ASSETS.fetch(request);
    }
    const response = await handler.fetch(request, env, ctx);
    const output = new Response(response.body, response);
    output.headers.set("X-Content-Type-Options", "nosniff");
    output.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    output.headers.set(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=()",
    );
    if (!import.meta.env.DEV)
      output.headers.set(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; media-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
      );
    if (isAdmin || request.headers.has("authorization")) {
      output.headers.set("Cache-Control", "private, no-store");
      output.headers.set("X-Robots-Tag", "noindex, nofollow");
      output.headers.set("Vary", "Authorization");
    }
    return output;
  },
};
