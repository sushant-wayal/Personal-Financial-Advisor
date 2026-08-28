import { withGmailAuth, fetchGmailMessage, extractEmailBody, searchGmailMessages } from "./gmail";
import { prisma } from "../lib/prisma";
import { parseDepositoryEmail } from "./depository-parser";
import { resolveMutualFundByIsin } from "./amfi-service";

export interface IngestDepositoryAlertInput {
    messageId?: string;
    content: string;
    timestamp?: Date;
}

export interface IngestDepositoryAlertResult {
    ok: boolean;
    processedCount: number;
    createdCount: number;
    updatedCount: number;
    skippedCount: number;
    funds: Array<{
        isin: string;
        schemeName: string;
        action: "CREATED" | "UPDATED" | "SKIPPED";
        units: number;
        newTotalUnits: number;
        worth?: number | null;
    }>;
}

/**
 * Process a depository email or body text containing mutual fund transaction records
 */
export async function ingestMutualFundDepositoryAlert(input: IngestDepositoryAlertInput): Promise<IngestDepositoryAlertResult> {
    const parsed = parseDepositoryEmail(input.content);
    const result: IngestDepositoryAlertResult = {
        ok: true,
        processedCount: 0,
        createdCount: 0,
        updatedCount: 0,
        skippedCount: 0,
        funds: []
    };

    if (parsed.isDepositoryAlert && parsed.items.length > 0) {
        for (const item of parsed.items) {
            // Only process Mutual Funds (ISIN starting with INF)
            if (item.assetType !== "MUTUAL_FUND" && !item.isin.startsWith("INF")) {
                continue;
            }

            result.processedCount++;

            // 1. Deduplication check if messageId is provided
            if (input.messageId) {
                const alreadyProcessed = await prisma.mutualFund.findFirst({
                    where: {
                        OR: [
                            { isin: item.isin, processedMessageIds: { has: input.messageId } },
                            { processedMessageIds: { has: `${input.messageId}:${item.isin}` } }
                        ]
                    }
                });

                if (alreadyProcessed) {
                    console.info(`[mf-webhook] Item ${item.isin} in message ${input.messageId} already processed`);
                    result.skippedCount++;
                    result.funds.push({
                        isin: item.isin,
                        schemeName: alreadyProcessed.schemeName,
                        action: "SKIPPED",
                        units: item.quantity,
                        newTotalUnits: alreadyProcessed.currentUnits,
                        worth: alreadyProcessed.currentWorth
                    });
                    continue;
                }
            }

            // 2. Resolve metadata from AMFI / MFAPI by ISIN
            const resolved = await resolveMutualFundByIsin(item.isin, item.companyName);

            // 3. Find if fund already exists in DB
            const existingFund = await prisma.mutualFund.findFirst({
                where: {
                    OR: [
                        { isin: item.isin },
                        ...(resolved?.schemeCode ? [{ schemeCode: resolved.schemeCode }] : []),
                        { schemeName: { equals: resolved?.schemeName || item.companyName, mode: "insensitive" } }
                    ]
                }
            });

            const effectiveMessageId = input.messageId ? `${input.messageId}:${item.isin}` : undefined;

            if (existingFund) {
                // Update existing fund
                const newUnits = item.type === "BUY" 
                    ? existingFund.currentUnits + item.quantity 
                    : Math.max(0, existingFund.currentUnits - item.quantity);

                const currentNav = resolved?.nav ?? existingFund.currentNav ?? null;
                const newWorth = currentNav !== null ? newUnits * currentNav : null;
                const updatedMessageIds = effectiveMessageId 
                    ? [...existingFund.processedMessageIds, effectiveMessageId].slice(-20)
                    : existingFund.processedMessageIds;

                const updated = await prisma.mutualFund.update({
                    where: { id: existingFund.id },
                    data: {
                        currentUnits: newUnits,
                        currentNav: currentNav ?? undefined,
                        currentWorth: newWorth,
                        isin: existingFund.isin || item.isin,
                        schemeCode: existingFund.schemeCode || resolved?.schemeCode || undefined,
                        processedMessageIds: updatedMessageIds
                    }
                });

                result.updatedCount++;
                result.funds.push({
                    isin: item.isin,
                    schemeName: updated.schemeName,
                    action: "UPDATED",
                    units: item.quantity,
                    newTotalUnits: newUnits,
                    worth: newWorth
                });
                console.info(`[mf-webhook] Updated fund ${updated.schemeName}: units = ${newUnits}, worth = ${newWorth}`);
            } else {
                // Auto-create new fund record
                if (item.type === "BUY") {
                    const currentNav = resolved?.nav ?? null;
                    const initialWorth = currentNav !== null ? item.quantity * currentNav : null;
                    const cleanName = resolved?.schemeName || item.companyName.replace(/#.*$/, "").trim() || item.isin;

                    const created = await prisma.mutualFund.create({
                        data: {
                            schemeName: cleanName,
                            schemeCode: resolved?.schemeCode || null,
                            isin: item.isin,
                            planType: resolved?.planType || "DIRECT",
                            option: resolved?.option || "GROWTH",
                            currentUnits: item.quantity,
                            currentNav: currentNav,
                            currentWorth: initialWorth,
                            setupDate: item.timestamp || input.timestamp || new Date(),
                            processedMessageIds: effectiveMessageId ? [effectiveMessageId] : []
                        }
                    });

                    result.createdCount++;
                    result.funds.push({
                        isin: item.isin,
                        schemeName: created.schemeName,
                        action: "CREATED",
                        units: item.quantity,
                        newTotalUnits: item.quantity,
                        worth: initialWorth
                    });
                    console.info(`[mf-webhook] Auto-created new fund ${created.schemeName}: units = ${item.quantity}, worth = ${initialWorth}`);
                }
            }
        }
        return result;
    }

    // Fallback: Non-depository heuristic regex matching for plain RTA emails without ISIN table
    const lowerContent = input.content.toLowerCase();
    const funds = await prisma.mutualFund.findMany();

    for (const fund of funds) {
        if (lowerContent.includes(fund.schemeName.toLowerCase())) {
            const unitsMatch = lowerContent.match(/units[\s:]+([0-9.]+)/i) || lowerContent.match(/units allotted[\s:]+([0-9.]+)/i);
            const typeMatch = lowerContent.match(/(purchase|sip|buy|allotment)/i) ? 'Buy' : (lowerContent.match(/(sell|redemption|switch out)/i) ? 'Sell' : null);

            if (unitsMatch && typeMatch) {
                const units = parseFloat(unitsMatch[1]);
                if (isNaN(units) || units <= 0) continue;

                if (input.messageId && fund.processedMessageIds.includes(input.messageId)) {
                    continue;
                }

                const updatedUnits = typeMatch === 'Buy' ? fund.currentUnits + units : Math.max(0, fund.currentUnits - units);
                const updatedWorth = fund.currentNav ? updatedUnits * fund.currentNav : null;
                const updatedMessageIds = input.messageId ? [...fund.processedMessageIds, input.messageId].slice(-20) : fund.processedMessageIds;

                await prisma.mutualFund.update({
                    where: { id: fund.id },
                    data: {
                        currentUnits: updatedUnits,
                        currentWorth: updatedWorth,
                        processedMessageIds: updatedMessageIds
                    }
                });

                result.processedCount++;
                result.updatedCount++;
                result.funds.push({
                    isin: fund.isin || "",
                    schemeName: fund.schemeName,
                    action: "UPDATED",
                    units,
                    newTotalUnits: updatedUnits,
                    worth: updatedWorth
                });
                break;
            }
        }
    }

    return result;
}

/**
 * Handle incoming Mutual Fund webhook / Gmail search polling
 */
export async function handleMutualFundWebhookPush(rawBody?: any) {
    console.info("[mf-webhook] received push", rawBody);
    
    let totalProcessed = 0;

    await withGmailAuth(async (accessToken) => {
        // Query recent emails from CDSL, NSDL, CAMS, KFintech, and mutual funds (last 2 days)
        const query = '("SIP" OR "redemption" OR "allotment" OR "folio" OR "Credit" OR "Debit" OR "Demat") (from:services@cdslindia.co.in OR from:cdslindia OR from:nsdl.co.in OR from:camsonline OR from:kfintech OR from:mutualfunds) newer_than:2d';
        const messages = await searchGmailMessages(accessToken, query, 30);
        
        console.info(`[mf-webhook] found ${messages.length} potential MF messages in Gmail`);

        for (const msg of messages) {
            if (!msg.id) continue;
            
            const fullMsg = await fetchGmailMessage(accessToken, msg.id);
            const content = extractEmailBody(fullMsg.payload) || fullMsg.snippet || "";
            if (!content) continue;

            const res = await ingestMutualFundDepositoryAlert({
                messageId: msg.id,
                content,
                timestamp: fullMsg.internalDate ? new Date(Number(fullMsg.internalDate)) : undefined
            });

            totalProcessed += res.processedCount;
        }
    });

    return { ok: true, totalProcessed };
}
