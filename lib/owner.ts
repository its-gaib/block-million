import { env } from "cloudflare:workers";
import { getChatGPTUser } from "@/app/chatgpt-auth";
export async function isOwner() {
  const user = await getChatGPTUser();
  const configured = (env as unknown as Record<string, string | undefined>)
    .ANALYTICS_OWNER_EMAIL;
  return (
    !!user &&
    !!configured &&
    user.email.toLowerCase() === configured.toLowerCase()
  );
}
