import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { verifyAdminAuthorization } from "./admin-auth";
export async function isOwner() {
  return verifyAdminAuthorization(
    (await headers()).get("authorization"),
    env.ADMIN_CREDENTIAL_SHA256,
  );
}
