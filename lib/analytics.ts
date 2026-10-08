export const EVENTS = [
  "page_view",
  "replay_block",
  "sound_on",
  "share",
  "watch_mode",
  "party_click",
  "community_click",
  "explorer_click",
  "source_click",
  "submit_party",
  "engaged_30s",
  "engaged_120s",
] as const;
export const SOURCES = [
  "direct",
  "google",
  "bing",
  "social",
  "github",
  "internal",
  "other",
] as const;
export const DEVICES = ["mobile", "desktop"] as const;
export function validEvent(
  input: unknown,
): input is {
  event: (typeof EVENTS)[number];
  session: string;
  source: (typeof SOURCES)[number];
  device: (typeof DEVICES)[number];
} {
  if (!input || typeof input !== "object") return false;
  const x = input as Record<string, unknown>;
  return (
    typeof x.event === "string" &&
    (EVENTS as readonly string[]).includes(x.event) &&
    typeof x.session === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      x.session,
    ) &&
    typeof x.source === "string" &&
    (SOURCES as readonly string[]).includes(x.source) &&
    typeof x.device === "string" &&
    (DEVICES as readonly string[]).includes(x.device)
  );
}
