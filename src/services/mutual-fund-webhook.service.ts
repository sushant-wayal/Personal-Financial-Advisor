import { withGmailAuth, fetchGmailMessage, extractEmailBody, searchGmailMessages } from "./gmail";
import { prisma } from "../lib/prisma";

export async function handleMutualFundWebhookPush(rawBody: any) {
    console.info("[mf-webhook] received push", rawBody);
    
    await withGmailAuth(async (accessToken) => {
        // Find recent emails containing mutual fund keywords (last 1 day)
        const query = '("SIP" OR "redemption" OR "allotment" OR "folio") (from:mutualfunds OR from:camsonline OR from:kfintech) newer_than:1d';
        const messages = await searchGmailMessages(accessToken, query, 20);
        
        for (const msg of messages) {
            if (!msg.id) continue;
            
            // Deduplication check
            const alreadyProcessed = await prisma.mutualFund.findFirst({
                where: {
                    processedMessageIds: {
                        has: msg.id
                    }
                }
            });
            if (alreadyProcessed) {
                console.info(`[mf-webhook] Message ${msg.id} already processed`);
                continue;
            }

            const fullMsg = await fetchGmailMessage(accessToken, msg.id);
            const content = extractEmailBody(fullMsg.payload) || fullMsg.snippet || "";
            const lowerContent = content.toLowerCase();
            
            // Find which mutual fund it matches
            const funds = await prisma.mutualFund.findMany();
            for (const fund of funds) {
                if (lowerContent.includes(fund.schemeName.toLowerCase())) {
                    console.info(`[mf-webhook] Found match for fund: ${fund.schemeName} in message ${msg.id}`);
                    
                    // Simple heuristic to extract units. Looking for patterns like "Units: 12.345" or "Units Allotted 12.345"
                    const unitsMatch = lowerContent.match(/units[\s:]+([0-9.]+)/i) || lowerContent.match(/units allotted[\s:]+([0-9.]+)/i);
                    const typeMatch = lowerContent.match(/(purchase|sip|buy|allotment)/i) ? 'Buy' : (lowerContent.match(/(sell|redemption|switch out)/i) ? 'Sell' : null);
                    
                    if (unitsMatch && typeMatch) {
                        const units = parseFloat(unitsMatch[1]);
                        if (isNaN(units) || units <= 0) continue;

                        const updatedUnits = typeMatch === 'Buy' ? fund.currentUnits + units : fund.currentUnits - units;
                        
                        console.info(`[mf-webhook] Updating units for ${fund.schemeName}: ${fund.currentUnits} -> ${updatedUnits} (${typeMatch} ${units})`);
                        const updatedMessageIds = [...fund.processedMessageIds, msg.id].slice(-10);

                        await prisma.mutualFund.update({
                            where: { id: fund.id },
                            data: {
                                currentUnits: updatedUnits,
                                currentWorth: fund.currentNav ? updatedUnits * fund.currentNav : null,
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
