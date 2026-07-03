type CacheEntry<T> = {
    value: T;
    cachedAt: number;
};

const clientCache = new Map<string, CacheEntry<unknown>>();

type FetchCacheOptions = {
    force?: boolean;
    ttlMs?: number;
};

export function getClientCache<T>(key: string): T | undefined {
    const entry = clientCache.get(key) as CacheEntry<T> | undefined;
    return entry?.value;
}

export function setClientCache<T>(key: string, value: T): T {
    clientCache.set(key, { value, cachedAt: Date.now() });
    return value;
}

export function clearClientCache() {
    clientCache.clear();
}

export async function fetchCachedValue<T>(key: string, fetcher: () => Promise<T>, options: FetchCacheOptions = {}): Promise<T> {
    const ttlMs = options.ttlMs ?? Number.POSITIVE_INFINITY;
    if (!options.force) {
        const entry = clientCache.get(key) as CacheEntry<T> | undefined;
        if (entry !== undefined) {
            const isFresh = Date.now() - entry.cachedAt <= ttlMs;
            if (isFresh) {
                return entry.value;
            }
            clientCache.delete(key);
        }
    }

    const value = await fetcher();
    setClientCache(key, value);
    return value;
}