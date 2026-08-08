import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";

export async function GET(_req: Request) {
    try {
        console.info("[cron] Starting daily Mutual Fund NAV update");

        // 1. Fetch all mutual funds with units > 0
        const funds = await prisma.mutualFund.findMany({
            where: { currentUnits: { gt: 0 } }
        });

        if (funds.length === 0) {
            console.info("[cron] No active mutual funds found with units > 0. Exiting.");
            return NextResponse.json({ ok: true, message: "No active funds" }, { status: 200 });
        }

        const updatedFunds = [];

        for (const fund of funds) {
            let schemeCode = fund.schemeCode;

            // 2. Resolve schemeCode if missing
            if (!schemeCode) {
                console.info(`[cron] Resolving schemeCode for ${fund.schemeName}`);
                try {
                    const searchRes = await fetch(`https://api.mfapi.in/mf/search?q=${encodeURIComponent(fund.schemeName)}`);
                    if (searchRes.ok) {
                        const searchData = await searchRes.json();
                        if (Array.isArray(searchData) && searchData.length > 0) {
                            schemeCode = String(searchData[0].schemeCode);
                            console.info(`[cron] Found schemeCode ${schemeCode} for ${fund.schemeName}`);
                            
                            // Save the schemeCode back to DB
                            await prisma.mutualFund.update({
                                where: { id: fund.id },
                                data: { schemeCode }
                            });
                        } else {
                            console.warn(`[cron] No scheme code found for ${fund.schemeName}`);
                            continue; // Skip this fund
                        }
                    } else {
                        console.error(`[cron] MFAPI search failed for ${fund.schemeName} with status ${searchRes.status}`);
                        continue;
                    }
                } catch (error) {
                    console.error(`[cron] Error searching schemeCode for ${fund.schemeName}:`, error);
                    continue;
                }
            }

            // 3. Fetch latest NAV
            try {
                const navRes = await fetch(`https://api.mfapi.in/mf/${schemeCode}`);
                if (navRes.ok) {
                    const navData = await navRes.json();
                    if (navData.data && Array.isArray(navData.data) && navData.data.length > 0) {
                        const latestNavStr = navData.data[0].nav;
                        const latestNav = parseFloat(latestNavStr);

                        if (!isNaN(latestNav)) {
                            const newWorth = latestNav * fund.currentUnits;
                            
                            await prisma.mutualFund.update({
                                where: { id: fund.id },
                                data: {
                                    currentNav: latestNav,
                                    currentWorth: newWorth
                                }
                            });

                            updatedFunds.push({ id: fund.id, name: fund.schemeName, oldNav: fund.currentNav, newNav: latestNav, newWorth });
                            console.info(`[cron] Updated ${fund.schemeName}: NAV = ${latestNav}, Worth = ${newWorth}`);
                        }
                    } else {
                        console.warn(`[cron] No NAV data array found for schemeCode ${schemeCode}`);
                    }
                } else {
                    console.error(`[cron] MFAPI NAV fetch failed for ${schemeCode} with status ${navRes.status}`);
                }
            } catch (error) {
                console.error(`[cron] Error fetching NAV for ${fund.schemeName}:`, error);
            }
        }

        return NextResponse.json({ ok: true, updatedFunds }, { status: 200 });

    } catch (error: any) {
        console.error("[cron] NAV update failed", error);
        return NextResponse.json({ error: error?.message || String(error) }, { status: 500 });
    }
}
