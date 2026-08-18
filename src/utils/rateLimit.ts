type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// This is a process-local fallback. It is only appropriate for authenticated
// routes, where the session id already bounds abuse and a restart-reset costs
// little. Public, unauthenticated, or mail-sending routes must use
// `durableRateLimit` in src/utils/durableRateLimit.ts instead.

/**
 * How many proxies in front of the app append to `X-Forwarded-For`.
 *
 * Caddy runs on this host, terminates TLS, and appends the socket peer, so the
 * rightmost entry is the real client and every entry to its left was written
 * by the caller. Counting from the right is what makes the result unforgeable:
 * a client can prepend as many entries as it likes and never shift the one we
 * read. A CDN added in front of Caddy later would set this to 1.
 */
const TRUSTED_PROXY_HOPS = (() => {
  const configured = Number(process.env.TRUSTED_PROXY_HOPS);
  return Number.isSafeInteger(configured) && configured >= 0 ? configured : 0;
})();

const IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/;
const IPV6 = /^[0-9a-f:]{2,45}$/i;

/**
 * Reduce one forwarded entry to a bare address, or reject it.
 *
 * Rate-limit keys and audit rows are built from this, so an unparseable entry
 * has to be dropped rather than passed through: otherwise a caller controls
 * both the bucket key and its length.
 */
function normalizeIp(value: string): string | null {
  let candidate = value.trim();
  if (!candidate || candidate.length > 64) return null;

  if (candidate.startsWith("[")) {
    // [2001:db8::1]:443 — the bracketed IPv6 form with an optional port.
    const close = candidate.indexOf("]");
    if (close === -1) return null;
    candidate = candidate.slice(1, close);
  } else if ((candidate.match(/:/g)?.length ?? 0) === 1) {
    // 203.0.113.7:52001 — only IPv4 carries a single colon.
    candidate = candidate.slice(0, candidate.indexOf(":"));
  }

  if (IPV4.test(candidate)) {
    return candidate.split(".").every((octet) => Number(octet) <= 255) ? candidate : null;
  }
  if (candidate.includes(":") && IPV6.test(candidate)) return candidate.toLowerCase();
  return null;
}

/**
 * The client address, taken from the last hop this deployment actually trusts.
 *
 * Never read the leftmost `X-Forwarded-For` entry: it is whatever the caller
 * typed. Doing so turns every IP-keyed rate limit into a no-op, because a new
 * value allocates a new bucket.
 */
export function getRequestIpFromHeaders(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded
      .split(",")
      .map(normalizeIp)
      .filter((hop): hop is string => hop !== null);
    if (hops.length) {
      const index = hops.length - 1 - TRUSTED_PROXY_HOPS;
      // A shorter chain than configured means the request did not arrive the
      // way we expect. The rightmost entry is still the least forgeable one.
      return hops[index >= 0 ? index : hops.length - 1];
    }
  }

  const real = headers.get("x-real-ip");
  return (real ? normalizeIp(real) : null) || "unknown";
}

/**
 * Server Components only have `headers()`, not a Request, so the derivation
 * lives in `getRequestIpFromHeaders` and this stays the Request-shaped door
 * onto it. Both must agree: a visitor identified one way for rate limiting and
 * another way for analytics would be two different people to us.
 */
export function getRequestIp(request: Request): string {
  return getRequestIpFromHeaders(request.headers);
}

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (current.count >= limit) return false;
  current.count += 1;

  if (buckets.size > 5_000) {
    for (const [bucketKey, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(bucketKey);
    }
  }

  return true;
}
