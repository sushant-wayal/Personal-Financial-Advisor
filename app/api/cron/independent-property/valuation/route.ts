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

        const properties = await prisma.independentPropertyAsset.findMany();
        
        if (properties.length === 0) {
            return NextResponse.json({ message: 'No active independent property assets found' });
        }

        const now = new Date();
        const updatedProperties = [];

        for (const property of properties) {
            let finalWorth = property.currentWorth;
            
            // If currentWorth is 0 (first run), fallback to purchasePrice
            if (finalWorth === 0) {
                finalWorth = property.purchasePrice;
            }

            // LLM Valuation
            try {
                const renovationText = property.lastRenovationYear ? `and was last renovated in ${property.lastRenovationYear}` : '';
                
                const prompt = `Estimate the current total market value (land + building) of an independent property in ${property.locality}, ${property.city}, ${property.state}, ${property.country}. 
The land area is ${property.landArea} ${property.landAreaUnit} and the built-up structure area is ${property.builtUpArea} sq ft.
The building was constructed in ${property.constructionYear} ${renovationText}.
Original Purchase Price: ₹${property.purchasePrice}.
Base your estimate on recent real estate market trends, appreciation rates, or government guidance/circle rates if available. 
Respond ONLY with a JSON object containing a single key "estimatedTotalValue" with the numeric value (no commas).
Do NOT wrap in markdown blocks, just raw JSON.`;

                const aiResponse = await generateText(
                    [{ role: 'user', content: prompt }],
                    { enableSearch: true }
                );

                const rawJsonStr = aiResponse.text.replace(/```json|```/g, "").trim();
                const data = JSON.parse(rawJsonStr);
                
                if (data && typeof data.estimatedTotalValue === 'number' && data.estimatedTotalValue > 0) {
                    const estimatedValue = data.estimatedTotalValue;
                    
                    // Simple sanity check: property prices rarely drop by more than 50% or jump by 1000% in a month.
                    if (estimatedValue < finalWorth * 0.5) {
                        console.warn(`[cron-independent-property] Severe drop detected for ${property.id}: ${finalWorth} -> ${estimatedValue}`);
                    }
                    if (estimatedValue > finalWorth * 10) {
                        console.warn(`[cron-independent-property] Massive jump detected for ${property.id}: ${finalWorth} -> ${estimatedValue}`);
                    }
                    
                    finalWorth = estimatedValue;
                    console.info(`[cron-independent-property] AI successfully valued property ${property.id} at ${finalWorth}`);
                } else {
                    console.warn(`[cron-independent-property] Invalid AI response for ${property.id}, using fallback ${finalWorth}`);
                }
            } catch (error) {
                console.error(`[cron-independent-property] AI valuation failed for ${property.id}, using fallback`, error);
            }

            // Update record if worth changed by more than 1 rupee
            if (Math.abs(finalWorth - property.currentWorth) > 1) {
                updatedProperties.push(
                    prisma.independentPropertyAsset.update({
                        where: { id: property.id },
                        data: {
                            currentWorth: finalWorth,
                            lastValuationDate: now
                        }
                    })
                );
            }
        }

        if (updatedProperties.length > 0) {
            await Promise.all(updatedProperties);
        }

        return NextResponse.json({
            message: `Processed ${properties.length} independent properties. Updated ${updatedProperties.length}.`,
            timestamp: now.toISOString(),
        });
    } catch (error: any) {
        console.error('[cron-independent-property] Error processing property assets:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
