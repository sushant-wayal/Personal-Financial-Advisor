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

        const vehicles = await prisma.vehicleAsset.findMany();
        
        if (vehicles.length === 0) {
            return NextResponse.json({ message: 'No active vehicle assets found' });
        }

        const now = new Date();
        const currentYear = now.getFullYear();
        const updatedVehicles = [];

        for (const vehicle of vehicles) {
            const ageInYears = Math.max(0, currentYear - vehicle.manufacturingYear);
            
            // Mileage Estimation
            let estimatedMileage = vehicle.odometerAtSetup || 0;
            if (!vehicle.odometerAtSetup) {
                const annualAvg = vehicle.type === "CAR" ? 10000 : 6000;
                estimatedMileage = ageInYears * annualAvg;
            }

            // Standard fallback depreciation (10% YoY)
            const fallbackWorth = vehicle.purchasePrice * Math.pow(0.90, ageInYears);
            let finalWorth = fallbackWorth;

            // LLM Valuation
            try {
                const prompt = `Estimate the current resale value in India of a ${vehicle.brand} ${vehicle.modelName} ${vehicle.variant} ${vehicle.fuelType ? '(' + vehicle.fuelType + ')' : ''}.
Manufactured in: ${vehicle.manufacturingYear}
Original Purchase Price: ₹${vehicle.purchasePrice}
Current estimated mileage: ~${estimatedMileage} km.
Respond ONLY with a JSON object containing a single key "estimatedValue" with the numeric value (no commas).
Do NOT wrap in markdown blocks, just raw JSON.`;

                const aiResponse = await generateText(
                    [{ role: 'user', content: prompt }],
                    { enableSearch: true }
                );

                const rawJsonStr = aiResponse.text.replace(/```json|```/g, "").trim();
                const data = JSON.parse(rawJsonStr);
                
                if (data && typeof data.estimatedValue === 'number' && data.estimatedValue > 0) {
                    // Prevent AI from hallucinating a value higher than original purchase price
                    finalWorth = Math.min(data.estimatedValue, vehicle.purchasePrice);
                    console.info(`[cron-vehicle] AI successfully valued ${vehicle.brand} ${vehicle.modelName} at ${finalWorth}`);
                } else {
                    console.warn(`[cron-vehicle] Invalid AI response for ${vehicle.id}, using fallback ${fallbackWorth}`);
                }
            } catch (error) {
                console.error(`[cron-vehicle] AI valuation failed for ${vehicle.id}, using fallback`, error);
                finalWorth = fallbackWorth;
            }

            // Update record if worth changed by more than 1 rupee
            if (Math.abs(finalWorth - vehicle.currentWorth) > 1) {
                updatedVehicles.push(
                    prisma.vehicleAsset.update({
                        where: { id: vehicle.id },
                        data: {
                            currentWorth: finalWorth,
                            lastValuationDate: now
                        }
                    })
                );
            }
        }

        if (updatedVehicles.length > 0) {
            await Promise.all(updatedVehicles);
        }

        return NextResponse.json({
            message: `Processed ${vehicles.length} vehicles. Updated ${updatedVehicles.length}.`,
            timestamp: now.toISOString(),
        });
    } catch (error: any) {
        console.error('[cron-vehicle] Error processing vehicle assets:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
