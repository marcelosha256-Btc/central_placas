interface RateLimitEntry {
  count: number;
  firstAttempt: number;
  blockedUntil?: number;
}

const store = new Map<string, RateLimitEntry>();

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const BLOCK_MS = 15 * 60 * 1000;

function cleanup() {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    const expired = entry.blockedUntil
      ? now > entry.blockedUntil + WINDOW_MS
      : now - entry.firstAttempt > WINDOW_MS * 2;
    if (expired) store.delete(key);
  }
}

export function checkRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  cleanup();
  const now = Date.now();
  const entry = store.get(ip);

  if (entry?.blockedUntil) {
    if (now < entry.blockedUntil) {
      return { allowed: false, retryAfter: Math.ceil((entry.blockedUntil - now) / 1000) };
    }
    store.delete(ip);
  }

  if (!entry || now - entry.firstAttempt > WINDOW_MS) {
    store.set(ip, { count: 1, firstAttempt: now });
    return { allowed: true };
  }

  entry.count += 1;
  if (entry.count > MAX_ATTEMPTS) {
    entry.blockedUntil = now + BLOCK_MS;
    return { allowed: false, retryAfter: Math.ceil(BLOCK_MS / 1000) };
  }

  return { allowed: true };
}
