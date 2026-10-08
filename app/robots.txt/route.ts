export function GET() {
  return new Response(
    "User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nSitemap: https://height-million.frosty-okapi-1278.chatgpt.site/sitemap.xml\n",
    { headers: { "Content-Type": "text/plain; charset=utf-8" } },
  );
}
