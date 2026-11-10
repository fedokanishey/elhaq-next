interface CacheEntry {
  data: any;
  timestamp: number;
}

// In-memory cache stored in global to survive module re-evaluations in Next.js
const globalForCache = globalThis as unknown as {
  _beneficiariesCache?: Map<string, CacheEntry>;
};

if (!globalForCache._beneficiariesCache) {
  globalForCache._beneficiariesCache = new Map<string, CacheEntry>();
}

const cache = globalForCache._beneficiariesCache;
const CACHE_TTL_MS = 60 * 1000; // 60 seconds TTL

export function getCachedBeneficiaries(key: string): any | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

export function setCachedBeneficiaries(key: string, data: any): void {
  cache.set(key, { data, timestamp: Date.now() });
}

export function invalidateBeneficiariesCache(): void {
  cache.clear();
}

