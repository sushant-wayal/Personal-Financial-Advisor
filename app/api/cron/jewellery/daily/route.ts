import { NextResponse } from 'next/server';
import prisma from '@/src/lib/prisma';
import { generateText } from '@/src/services/gemini';

export const maxDuration = 300;

export async function GET(request: Request) {
    try {
        const authHeader = request.headers.get('authorization');
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const jewelleryItems = await prisma.jewelleryAsset.findMany();
        
        if (jewelleryItems.length === 0) {
            return NextResponse.json({ message: 'No active jewellery assets found' });
        }

        // 1. Fetch Global Rates
        let rates = { gold: 0, silver: 0, platinum: 0 };
        try {
            const prompt = `Find the current live market price in India (in INR per gram) for the following three precious metals:
1. 24K Gold
2. 999 Fine Silver
3. 999 Platinum
Respond ONLY with a JSON object exactly in this format, substituting 0 with the actual numeric value (no commas):
{ "gold": 0, "silver": 0, "platinum": 0 }
Do NOT wrap in markdown blocks, just raw JSON.`;

            const aiResponse = await generateText(
                [{ role: 'user', content: prompt }],
                { enableSearch: true }
            );

            const rawJsonStr = aiResponse.text.replace(/```json|```/g, "").trim();
            const data = JSON.parse(rawJsonStr);
            
            if (data && typeof data.gold === 'number' && typeof data.silver === 'number' && typeof data.platinum === 'number') {
                rates = data;
                console.info(`[cron-jewellery] Fetched market rates via AI: Gold ₹${rates.gold}/g, Silver ₹${rates.silver}/g, Platinum ₹${rates.platinum}/g`);
            } else {
                throw new Error("Invalid AI JSON structure");
            }
        } catch (error) {
            console.error(`[cron-jewellery] AI rate fetch failed. Aborting update to prevent corruption.`, error);
            return NextResponse.json({ error: 'Failed to fetch global commodity rates.' }, { status: 500 });
        }

        if (rates.gold <= 0 || rates.silver <= 0 || rates.platinum <= 0) {
            return NextResponse.json({ error: 'Fetched rates are zero or invalid. Aborting.' }, { status: 500 });
        }

        const now = new Date();
        const updatedItems = [];

        // 2. Compute Individual Worth
        for (const item of jewelleryItems) {
            let weightInGrams = item.netWeight;
            if (item.weightUnit.toLowerCase() === 'kg') {
                weightInGrams = item.netWeight * 1000;
            }

            let fineWeight = 0;
            let currentPricePerGram = 0;
            
            const metalType = item.metalType.toUpperCase();
            
            if (metalType === 'GOLD') {
                fineWeight = weightInGrams * (item.purity / 24);
                currentPricePerGram = rates.gold;
            } else if (metalType === 'PLATINUM') {
                fineWeight = weightInGrams * (item.purity / 24);
                currentPricePerGram = rates.platinum;
            } else if (metalType === 'SILVER') {
                // Assuming standard purity scaling out of 999
                fineWeight = weightInGrams * (item.purity / 999);
                currentPricePerGram = rates.silver;
            } else {
                console.warn(`[cron-jewellery] Unknown metal type ${metalType} for item ${item.id}. Skipping.`);
                continue;
            }

            const finalWorth = fineWeight * currentPricePerGram;

            // Update record if worth changed by more than 1 rupee
            if (Math.abs(finalWorth - item.currentWorth) > 1) {
                updatedItems.push(
                    prisma.jewelleryAsset.update({
                        where: { id: item.id },
                        data: {
                            currentWorth: finalWorth,
                            lastValuationDate: now
                        }
                    })
                );
            }
        }

        if (updatedItems.length > 0) {
            await Promise.all(updatedItems);
        }

        return NextResponse.json({
            message: `Processed ${jewelleryItems.length} jewellery items. Updated ${updatedItems.length}.`,
            timestamp: now.toISOString(),
        });
    } catch (error: any) {
        console.error('[cron-jewellery] Error processing jewellery assets:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
