const TRUSTED_PROXY_HOP_COUNT = Number(process.env.TRUSTED_PROXY_HOP_COUNT ?? "0");

/**
 * Returns the client IP, or null when there's no trustworthy way to
 * determine it.
 *
 * `X-Forwarded-For` is entirely client-controlled unless a trusted reverse
 * proxy sits in front of this app and appends to it — trusting it
 * unconditionally lets any caller reset their own rate-limit bucket by
 * sending an arbitrary value. With the safe default (0 trusted hops, no
 * proxy configured), there is currently no reliable way to read the raw
 * connection IP through a Next.js Route Handler on a self-hosted server
 * either, so this deliberately returns null rather than trusting an
 * unverifiable header — IP-based limiting is a secondary layer on top of
 * the identifier-keyed bucket, never the only one, so degrading to "no IP
 * layer" here is acceptable. Revisit once a deployment target/reverse
 * proxy is chosen and TRUSTED_PROXY_HOP_COUNT is set accordingly.
 */
export function getClientIp(request: Request): string | null {
  if (TRUSTED_PROXY_HOP_COUNT <= 0) {
    return null;
  }

  const forwardedFor = request.headers.get("x-forwarded-for");
  if (!forwardedFor) return null;

  const hops = forwardedFor
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  // Nth-from-the-right entry — the proxy-appended end — never the
  // left-most, client-controlled end.
  const index = hops.length - TRUSTED_PROXY_HOP_COUNT;
  return hops[index] ?? null;
}

export function getUserAgent(request: Request): string | null {
  return request.headers.get("user-agent");
}
