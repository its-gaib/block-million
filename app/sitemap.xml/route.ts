export function GET() {
  return new Response(
    '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://height-million.frosty-okapi-1278.chatgpt.site/</loc></url><url><loc>https://height-million.frosty-okapi-1278.chatgpt.site/privacy</loc></url></urlset>',
    { headers: { "Content-Type": "application/xml; charset=utf-8" } },
  );
}
