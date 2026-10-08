declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    ASSETS?: Fetcher;
    ADMIN_CREDENTIAL_SHA256?: string;
  }
}
