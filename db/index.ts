import { env } from "cloudflare:workers";
export function getDatabase(): D1Database {
  if (!env.DB) throw new Error("Analytics storage is unavailable");
  return env.DB;
}
