import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";

function getYahooFinanceSymbol(symbol: string, exchange: string): string {
    const exchangeUpper = exchange.toUpperCase().trim();
    if (exchangeUpper === "NSE") return `${symbol}.NS`;
    if (exchangeUpper === "BSE") return `${symbol}.BO`;
    if (exchangeUpper === "NASDAQ" || exchangeUpper === "NYSE") return symbol; // No suffix needed for US
    
    // Default to just the symbol if exchange is unknown, though you could map more here.
    return symbol;
}

export async function GET(_req: Request) {
    try {
        console.info("[cron] Starting daily Stock price update");

        // 1. Fetch all stocks with quantity > 0
        const stocks = await prisma.stock.findMany({
            where: { currentQuantity: { gt: 0 } }
        });

        if (stocks.length === 0) {
            console.info("[cron] No active stocks found with quantity > 0. Exiting.");
            return NextResponse.json({ ok: true, message: "No active stocks" }, { status: 200 });
        }

        const updatedStocks = [];

        for (const stock of stocks) {
            const querySymbol = getYahooFinanceSymbol(stock.symbol, stock.exchange);

            try {
                // Fetch the latest closing price using the free Yahoo Finance chart endpoint
                const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(querySymbol)}?interval=1d&range=1d`;
                console.info(`[cron] Fetching price for ${stock.symbol} via ${querySymbol} URL: ${url}`);
                
                const res = await fetch(url, {
                    headers: {
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" // Prevents basic blocks from YF
                    }
                });

                if (res.ok) {
                    const data = await res.json();
                    
                    if (data?.chart?.result?.[0]?.meta?.regularMarketPrice) {
                        const latestPrice = parseFloat(data.chart.result[0].meta.regularMarketPrice);
                        
                        if (!isNaN(latestPrice)) {
                            const newWorth = latestPrice * stock.currentQuantity;
                            
                            await prisma.stock.update({
                                where: { id: stock.id },
                                data: {
                                    currentPrice: latestPrice,
                                    currentWorth: newWorth
                                }
                            });

                            updatedStocks.push({ 
                                id: stock.id, 
                                symbol: stock.symbol, 
                                oldPrice: stock.currentPrice, 
                                newPrice: latestPrice, 
                                newWorth 
                            });
                            console.info(`[cron] Updated ${stock.symbol}: Price = ${latestPrice}, Worth = ${newWorth}`);
                        }
                    } else {
                        console.warn(`[cron] No valid price data returned for ${querySymbol}`);
                    }
                } else {
                    console.error(`[cron] Yahoo Finance API failed for ${querySymbol} with status ${res.status}`);
                }
            } catch (error) {
                console.error(`[cron] Error fetching price for ${stock.symbol}:`, error);
            }
        }

        return NextResponse.json({ ok: true, updatedStocks }, { status: 200 });

    } catch (error: any) {
        console.error("[cron] Stock price update failed", error);
        return NextResponse.json({ error: error?.message || String(error) }, { status: 500 });
    }
}
