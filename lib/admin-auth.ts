/** Verify a high-entropy HTTP Basic credential without trusting proxy identity headers. */
export async function verifyAdminAuthorization(
  authorization: string | null,
  expectedDigest: string | undefined,
): Promise<boolean> {
  if (
    !expectedDigest ||
    !/^[0-9a-f]{64}$/.test(expectedDigest) ||
    !authorization ||
    authorization.length > 512 ||
    !authorization.startsWith("Basic ")
  )
    return false;
  let credential: string;
  try {
    credential = atob(authorization.slice(6));
  } catch {
    return false;
  }
  if (!credential.startsWith("owner:") || credential.length > 200) return false;
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(credential)),
  );
  let difference = 0;
  for (let i = 0; i < digest.length; i++)
    difference |=
      digest[i] ^ parseInt(expectedDigest.slice(i * 2, i * 2 + 2), 16);
  return difference === 0;
}
export function adminChallenge() {
  return new Response("Owner authentication required.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="BLOCK MILLION owner", charset="UTF-8"',
      "Cache-Control": "private, no-store",
      Vary: "Authorization",
      "X-Robots-Tag": "noindex, nofollow",
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
