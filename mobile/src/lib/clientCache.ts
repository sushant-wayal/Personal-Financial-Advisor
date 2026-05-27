const clientCache = new Map<string, unknown>();

type FetchCacheOptions = {
    force?: boolean;
};

export function getClientCache<T>(key: string): T | undefined {
    return clientCache.get(key) as T | undefined;
}

export function setClientCache<T>(key: string, value: T): T {
    clientCache.set(key, value);
    return value;
}

export function clearClientCache() {
    clientCache.clear();
}

export async function fetchCachedValue<T>(key: string, fetcher: () => Promise<T>, options: FetchCacheOptions = {}): Promise<T> {
    if (!options.force) {
        const cached = getClientCache<T>(key);
        if (cached !== undefined) {
            return cached;
        }
    }

    const value = await fetcher();
    setClientCache(key, value);
    return value;
}