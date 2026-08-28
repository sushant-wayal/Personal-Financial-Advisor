/**
 * AMFI & MFAPI Service
 * Provides deterministic ISIN -> Mutual Fund metadata and NAV resolution
 */

export interface AmfiResolvedFund {
    schemeCode: string;
    isin: string;
    schemeName: string;
    planType: "DIRECT" | "REGULAR";
    option: "GROWTH" | "DIVIDEND";
    nav: number | null;
    navDate?: string;
}

interface AmfiCache {
    byIsin: Map<string, AmfiResolvedFund>;
    bySchemeCode: Map<string, AmfiResolvedFund>;
    lastFetched: number;
}

let amfiCache: AmfiCache | null = null;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

/**
 * Fetch and parse official AMFI master list (NAVAll.txt)
 */
export async function loadAmfiMasterData(forceRefresh = false): Promise<AmfiCache> {
    const now = Date.now();
    if (!forceRefresh && amfiCache && (now - amfiCache.lastFetched) < CACHE_TTL_MS) {
        return amfiCache;
    }

    try {
        const res = await fetch("https://www.amfiindia.com/spages/NAVAll.txt", {
            headers: { "User-Agent": "Mozilla/5.0 (compatible; PersonalFinancialAdvisor/1.0)" },
            signal: AbortSignal.timeout(10000)
        });

        if (!res.ok) {
            throw new Error(`Failed to fetch AMFI data: ${res.status} ${res.statusText}`);
        }

        const text = await res.text();
        const lines = text.split(/\r?\n/);
        
        const byIsin = new Map<string, AmfiResolvedFund>();
        const bySchemeCode = new Map<string, AmfiResolvedFund>();

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.includes(";")) continue;

            // Structure: Scheme Code;ISIN Div Payout/ISIN Growth;ISIN Div Reinvestment;Scheme Name;Net Asset Value;Date
            const parts = trimmed.split(";");
            if (parts.length < 5) continue;

            const schemeCode = parts[0]?.trim();
            if (!schemeCode || isNaN(Number(schemeCode))) continue;

            const isin1 = parts[1]?.trim();
            const isin2 = parts[2]?.trim();
            
            const date = parts[parts.length - 1]?.trim();
            const navStr = parts[parts.length - 2]?.trim();
            const nameParts = parts.slice(3, parts.length - 2);
            const schemeName = nameParts.join(" - ").trim() || parts[3]?.trim();

            const parsedNav = parseFloat(navStr);
            const nav = isNaN(parsedNav) ? null : parsedNav;

            const upperName = schemeName.toUpperCase();
            const planType: "DIRECT" | "REGULAR" = upperName.includes("DIRECT") ? "DIRECT" : "REGULAR";
            const option: "GROWTH" | "DIVIDEND" = (upperName.includes("DIVIDEND") || upperName.includes("IDCW")) ? "DIVIDEND" : "GROWTH";

            const fundInfo: AmfiResolvedFund = {
                schemeCode,
                isin: (isin1 && isin1 !== "-") ? isin1 : ((isin2 && isin2 !== "-") ? isin2 : ""),
                schemeName,
                planType,
                option,
                nav,
                navDate: date
            };

            if (fundInfo.isin) {
                byIsin.set(fundInfo.isin.toUpperCase(), fundInfo);
            }
            if (isin1 && isin1 !== "-") {
                byIsin.set(isin1.toUpperCase(), { ...fundInfo, isin: isin1 });
            }
            if (isin2 && isin2 !== "-") {
                byIsin.set(isin2.toUpperCase(), { ...fundInfo, isin: isin2 });
            }
            bySchemeCode.set(schemeCode, fundInfo);
        }

        amfiCache = {
            byIsin,
            bySchemeCode,
            lastFetched: now
        };

        return amfiCache;
    } catch (error) {
        console.warn("[amfi-service] Error loading AMFI master data:", error);
        if (amfiCache) return amfiCache;
        return { byIsin: new Map(), bySchemeCode: new Map(), lastFetched: 0 };
    }
}

/**
 * Resolve mutual fund details by ISIN with AMFI + MFAPI fallback
 */
export async function resolveMutualFundByIsin(isin: string, fallbackName?: string): Promise<AmfiResolvedFund | null> {
    if (!isin) return null;
    const cleanIsin = isin.trim().toUpperCase();

    // 1. Try AMFI master lookup
    const cache = await loadAmfiMasterData();
    const match = cache.byIsin.get(cleanIsin);
    if (match) {
        return match;
    }

    // 2. Fallback: If AMFI didn't match and fallbackName provided, search mfapi.in
    if (fallbackName) {
        try {
            const cleanQuery = fallbackName
                .replace(/#.*$/, "")
                .replace(/[\/-]/g, " ")
                .replace(/\s+/g, " ")
                .trim();
            
            const searchRes = await fetch(`https://api.mfapi.in/mf/search?q=${encodeURIComponent(cleanQuery)}`, {
                signal: AbortSignal.timeout(5000)
            });
            if (searchRes.ok) {
                const results = await searchRes.json();
                if (Array.isArray(results) && results.length > 0) {
                    const topMatch = results[0];
                    const schemeCode = String(topMatch.schemeCode);
                    const schemeName = topMatch.schemeName;
                    
                    const latestNav = await fetchLatestNavFromMfApi(schemeCode);
                    const upperName = schemeName.toUpperCase();
                    return {
                        schemeCode,
                        isin: cleanIsin,
                        schemeName,
                        planType: upperName.includes("DIRECT") ? "DIRECT" : "REGULAR",
                        option: (upperName.includes("DIVIDEND") || upperName.includes("IDCW")) ? "DIVIDEND" : "GROWTH",
                        nav: latestNav
                    };
                }
            }
        } catch (err) {
            console.error("[amfi-service] Fallback MFAPI search failed:", err);
        }
    }

    return null;
}

/**
 * Fetch latest NAV from mfapi.in
 */
export async function fetchLatestNavFromMfApi(schemeCode: string): Promise<number | null> {
    try {
        const res = await fetch(`https://api.mfapi.in/mf/${schemeCode}/latest`, {
            signal: AbortSignal.timeout(5000)
        });
        if (res.ok) {
            const data = await res.json();
            if (data?.data && Array.isArray(data.data) && data.data.length > 0) {
                const nav = parseFloat(data.data[0].nav);
                return isNaN(nav) ? null : nav;
            }
        }
    } catch (e) {
        console.warn(`[amfi-service] Failed to fetch latest NAV for ${schemeCode}:`, e);
    }
    return null;
}
