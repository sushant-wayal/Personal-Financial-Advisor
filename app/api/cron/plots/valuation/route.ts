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

        const plots = await prisma.plotAsset.findMany();
        
        if (plots.length === 0) {
            return NextResponse.json({ message: 'No active plot assets found' });
        }

        const now = new Date();
        const updatedPlots = [];

        for (const plot of plots) {
            let finalWorth = plot.currentWorth;
            
            // If currentWorth is 0 (first run), fallback to purchasePrice
            if (finalWorth === 0) {
                finalWorth = plot.purchasePrice;
            }

            // LLM Valuation
            try {
                const prompt = `Estimate the current average real estate land price per ${plot.areaUnit} in ${plot.locality}, ${plot.city}, ${plot.state}, ${plot.country}. Base this on recent market trends or government guidance/circle rates if available. 
Original Purchase Price: ₹${plot.purchasePrice} for ${plot.area} ${plot.areaUnit}.
Respond ONLY with a JSON object containing a single key "ratePerUnit" with the numeric value (no commas).
Do NOT wrap in markdown blocks, just raw JSON.`;

                const aiResponse = await generateText(
                    [{ role: 'user', content: prompt }],
                    { enableSearch: true }
                );

                const rawJsonStr = aiResponse.text.replace(/```json|```/g, "").trim();
                const data = JSON.parse(rawJsonStr);
                
                if (data && typeof data.ratePerUnit === 'number' && data.ratePerUnit > 0) {
                    const estimatedValue = data.ratePerUnit * plot.area;
                    
                    // Simple sanity check: land prices rarely drop by more than 50% or jump by 1000% in a month.
                    // If it does, we can log a warning, but we still accept it as market reality or AI estimation.
                    if (estimatedValue < finalWorth * 0.5) {
                        console.warn(`[cron-plot] Severe drop detected for ${plot.id}: ${finalWorth} -> ${estimatedValue}`);
                    }
                    if (estimatedValue > finalWorth * 10) {
                        console.warn(`[cron-plot] Massive jump detected for ${plot.id}: ${finalWorth} -> ${estimatedValue}`);
                    }
                    
                    finalWorth = estimatedValue;
                    console.info(`[cron-plot] AI successfully valued plot ${plot.id} at ${finalWorth}`);
                } else {
                    console.warn(`[cron-plot] Invalid AI response for ${plot.id}, using fallback ${finalWorth}`);
                }
            } catch (error) {
                console.error(`[cron-plot] AI valuation failed for ${plot.id}, using fallback`, error);
            }

            // Update record if worth changed by more than 1 rupee
            if (Math.abs(finalWorth - plot.currentWorth) > 1) {
                updatedPlots.push(
                    prisma.plotAsset.update({
                        where: { id: plot.id },
                        data: {
                            currentWorth: finalWorth,
                            lastValuationDate: now
                        }
                    })
                );
            }
        }

        if (updatedPlots.length > 0) {
            await Promise.all(updatedPlots);
        }

        return NextResponse.json({
            message: `Processed ${plots.length} plots. Updated ${updatedPlots.length}.`,
            timestamp: now.toISOString(),
        });
    } catch (error: any) {
        console.error('[cron-plot] Error processing plot assets:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
