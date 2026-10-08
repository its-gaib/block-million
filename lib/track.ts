export type EventName =
  | "page_view"
  | "replay_block"
  | "sound_on"
  | "share"
  | "watch_mode"
  | "party_click"
  | "community_click"
  | "explorer_click"
  | "source_click"
  | "submit_party"
  | "engaged_30s"
  | "engaged_120s";
let memorySession: string | undefined;
export function track(event: EventName) {
  if (
    typeof window === "undefined" ||
    navigator.doNotTrack === "1" ||
    (navigator as Navigator & { globalPrivacyControl?: boolean })
      .globalPrivacyControl
  )
    return;
  let session = memorySession;
  try {
    session = sessionStorage.getItem("hm-session") || undefined;
  } catch {}
  session ||= crypto.randomUUID();
  memorySession = session;
  try {
    sessionStorage.setItem("hm-session", session);
  } catch {}
  let source = "direct";
  try {
    const host = new URL(document.referrer).hostname;
    source = /(^|\.)google\./.test(host)
      ? "google"
      : /(^|\.)bing\.com$/.test(host)
        ? "bing"
        : /(^|\.)(x|twitter)\.com$/.test(host)
          ? "social"
          : /(^|\.)github\.com$/.test(host)
            ? "github"
            : host === location.hostname
              ? "internal"
              : "other";
  } catch {}
  fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event,
      session,
      source,
      device: matchMedia("(max-width: 760px)").matches ? "mobile" : "desktop",
    }),
    keepalive: true,
  }).catch(() => {});
}
