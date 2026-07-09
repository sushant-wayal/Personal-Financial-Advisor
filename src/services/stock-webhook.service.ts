import { withGmailAuth, fetchGmailMessage, extractEmailBody, searchGmailMessages } from "./gmail";
import { prisma } from "../lib/prisma";

export async function handleStockWebhookPush(rawBody: any) {
    console.info("[stock-webhook] received push", rawBody);
    
    await withGmailAuth(async (accessToken) => {
        // Find recent emails containing stock transaction keywords (last 1 day)
        // Adjust broker list as needed (zerodha, groww, upstox, angelone, etc.)
        const query = '("contract note" OR "trade confirmation" OR "bought" OR "sold") (from:zerodha OR from:groww OR from:upstox OR from:angel) newer_than:1d';
        const messages = await searchGmailMessages(accessToken, query, 20);
        
        for (const msg of messages) {
            if (!msg.id) continue;
            
            // Deduplication check
            const alreadyProcessed = await prisma.stock.findFirst({
                where: {
                    processedMessageIds: {
                        has: msg.id
                    }
                }
            });
            if (alreadyProcessed) {
                console.info(`[stock-webhook] Message ${msg.id} already processed`);
                continue;
            }

            const fullMsg = await fetchGmailMessage(accessToken, msg.id);
            const content = extractEmailBody(fullMsg.payload) || fullMsg.snippet || "";
            const lowerContent = content.toLowerCase();
            
            // Find which stock it matches
            const stocks = await prisma.stock.findMany();
            for (const stock of stocks) {
                if (lowerContent.includes(stock.symbol.toLowerCase())) {
                    console.info(`[stock-webhook] Found match for stock: ${stock.symbol} in message ${msg.id}`);
                    
                    // Simple heuristic to extract quantity (Qty/Quantity)
                    // Matches patterns like "Qty: 10", "Quantity: 50", "bought 15 shares"
                    const qtyMatch = lowerContent.match(/(?:qty|quantity)[\s:]+([0-9.]+)/i) || 
                                     lowerContent.match(/(?:bought|sold)\s+([0-9.]+)\s+(?:shares|qty)/i);
                    const typeMatch = lowerContent.match(/(buy|bought)/i) ? 'Buy' : (lowerContent.match(/(sell|sold)/i) ? 'Sell' : null);
                    
                    if (qtyMatch && typeMatch) {
                        const qty = parseFloat(qtyMatch[1]);
                        if (isNaN(qty) || qty <= 0) continue;

                        const updatedQty = typeMatch === 'Buy' ? stock.currentQuantity + qty : stock.currentQuantity - qty;
                        
                        console.info(`[stock-webhook] Updating quantity for ${stock.symbol}: ${stock.currentQuantity} -> ${updatedQty} (${typeMatch} ${qty})`);
                        
                        const updatedMessageIds = [...stock.processedMessageIds, msg.id].slice(-10);

                        await prisma.stock.update({
                            where: { id: stock.id },
                            data: {
                                currentQuantity: updatedQty,
                                currentWorth: stock.currentPrice ? updatedQty * stock.currentPrice : null,
                                processedMessageIds: updatedMessageIds
                            }
                        });
                        break; // Move to the next message once processed
                    }
                }
            }
        }
    });

    return { ok: true };
}
