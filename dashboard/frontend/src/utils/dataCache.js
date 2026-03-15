/**
 * Simple in-memory cache shared across pages.
 * Avoids refetching the same data when navigating between Dashboard ↔ All Snags.
 * Each entry has a TTL (default 30s). Mutations can call invalidate() to bust stale data.
 */

const store = new Map();
const DEFAULT_TTL = 30_000; // 30 seconds

export function getCached(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > entry.ttl) {
    store.delete(key);
    return null;
  }
  return entry.data;
}

export function setCache(key, data, ttl = DEFAULT_TTL) {
  store.set(key, { data, ts: Date.now(), ttl });
}

/** Bust one key or all keys matching a prefix */
export function invalidate(keyOrPrefix) {
  if (store.has(keyOrPrefix)) {
    store.delete(keyOrPrefix);
  } else {
    for (const k of store.keys()) {
      if (k.startsWith(keyOrPrefix)) store.delete(k);
    }
  }
}

/**
 * Fetch with cache — returns cached data if fresh, otherwise calls fetchFn and caches result.
 */
export async function cachedFetch(key, fetchFn, ttl = DEFAULT_TTL) {
  const cached = getCached(key);
  if (cached) return cached;
  const data = await fetchFn();
  if (data && !data.error) setCache(key, data, ttl);
  return data;
}
