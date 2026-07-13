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

        const apartments = await prisma.apartmentAsset.findMany();
        
        if (apartments.length === 0) {
            return NextResponse.json({ message: 'No active apartment assets found' });
        }

        const now = new Date();
        const updatedApartments = [];

        for (const apartment of apartments) {
            let finalWorth = apartment.currentWorth || 0;
            
            // If currentWorth is 0 (first run), fallback to purchasePrice
            if (finalWorth === 0) {
                finalWorth = apartment.purchasePrice || 0;
            }

            // LLM Valuation
            try {
                const builderText = apartment.builder ? `built by ${apartment.builder}` : '';
                const projectText = apartment.projectName ? `in the project/society "${apartment.projectName}"` : '';
                const bhkText = apartment.bhk ? `It is a ${apartment.bhk} configuration.` : '';
                const floorText = apartment.floorNumber ? `It is located on floor: ${apartment.floorNumber}.` : '';
                const renovationText = apartment.lastRenovationYear ? `and was last renovated in ${apartment.lastRenovationYear}` : '';
                
                const prompt = `Estimate the current total market value of an apartment/flat in ${apartment.locality}, ${apartment.city}, ${apartment.state}, ${apartment.country}. 
The built-up area is ${apartment.builtUpArea} sq ft. ${bhkText} ${floorText} ${projectText} ${builderText}.
It was constructed in ${apartment.constructionYear} ${renovationText}.
Original Purchase Price: ₹${apartment.purchasePrice}.
Base your estimate on recent real estate market trends, appreciation rates, or property listings if available. 
Respond ONLY with a JSON object containing a single key "estimatedMarketValue" with the numeric value (no commas).
Do NOT wrap in markdown blocks, just raw JSON.`;

                const aiResponse = await generateText(
                    [{ role: 'user', content: prompt }],
                    { enableSearch: true }
                );

                const rawJsonStr = aiResponse.text.replace(/```json|```/g, "").trim();
                const data = JSON.parse(rawJsonStr);
                
                if (data && typeof data.estimatedMarketValue === 'number' && data.estimatedMarketValue > 0) {
                    const estimatedValue = data.estimatedMarketValue;
                    
                    // Simple sanity check: property prices rarely drop by more than 50% or jump by 1000% in a month.
                    if (estimatedValue < finalWorth * 0.5) {
                        console.warn(`[cron-apartment] Severe drop detected for ${apartment.id}: ${finalWorth} -> ${estimatedValue}`);
                    }
                    if (estimatedValue > finalWorth * 10) {
                        console.warn(`[cron-apartment] Massive jump detected for ${apartment.id}: ${finalWorth} -> ${estimatedValue}`);
                    }
                    
                    finalWorth = estimatedValue;
                    console.info(`[cron-apartment] AI successfully valued apartment ${apartment.id} at ${finalWorth}`);
                } else {
                    console.warn(`[cron-apartment] Invalid AI response for ${apartment.id}, using fallback ${finalWorth}`);
                }
            } catch (error) {
                console.error(`[cron-apartment] AI valuation failed for ${apartment.id}, using fallback`, error);
            }

            // Update record if worth changed by more than 1 rupee
            if (Math.abs(finalWorth - (apartment.currentWorth || 0)) > 1) {
                updatedApartments.push(
                    prisma.apartmentAsset.update({
                        where: { id: apartment.id },
                        data: {
                            currentWorth: finalWorth,
                            lastValuationDate: now
                        }
                    })
                );
            }
        }

        if (updatedApartments.length > 0) {
            await Promise.all(updatedApartments);
        }

        return NextResponse.json({
            message: `Processed ${apartments.length} apartments. Updated ${updatedApartments.length}.`,
            timestamp: now.toISOString(),
        });
    } catch (error: any) {
        console.error('[cron-apartment] Error processing apartment assets:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
