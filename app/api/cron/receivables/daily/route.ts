import { NextResponse } from 'next/server';
import prisma from '@/src/lib/prisma';

export const maxDuration = 60;

export async function GET(request: Request) {
    try {
        const authHeader = request.headers.get('authorization');
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const receivables = await prisma.receivableAsset.findMany();
        
        if (receivables.length === 0) {
            return NextResponse.json({ message: 'No active receivable assets found' });
        }

        const now = new Date();
        const updatedItems = [];

        for (const item of receivables) {
            let isOverdue = item.isOverdue;
            
            // 1. Check if expected return date has passed
            if (item.expectedReturnDate && new Date(item.expectedReturnDate) < now) {
                isOverdue = true;
            } else if (item.expectedReturnDate && new Date(item.expectedReturnDate) >= now) {
                isOverdue = false; // in case it was extended
            }

            // 2. Accrue Interest
            let accruedInterest = item.accruedInterest;
            
            if (item.interestRate && item.interestRate > 0) {
                if (item.interestType === 'SIMPLE') {
                    // Daily Simple Interest = P * R * T, where T = 1/365
                    const dailyInterest = item.principalAmount * (item.interestRate / 100) / 365;
                    accruedInterest += dailyInterest;
                } else if (item.interestType === 'COMPOUND') {
                    // Daily Compound Interest: calculate the exact compounded worth for today vs yesterday,
                    // but since this runs daily, we can use the formula: A = P(1 + r/n)^(nt)
                    // For a daily compounding step: new worth = old worth * (1 + (r / 365))
                    // Note: Here "old worth" includes the already accrued interest.
                    const currentTotal = item.principalAmount + accruedInterest;
                    const dailyInterest = currentTotal * ((item.interestRate / 100) / 365);
                    accruedInterest += dailyInterest;
                }
            }

            const currentWorth = item.principalAmount + accruedInterest;

            // Only update if things changed
            if (
                isOverdue !== item.isOverdue ||
                Math.abs(currentWorth - (item.currentWorth || 0)) > 0.01 // allow for 1 paisa rounding diff
            ) {
                updatedItems.push(
                    prisma.receivableAsset.update({
                        where: { id: item.id },
                        data: {
                            accruedInterest,
                            currentWorth,
                            isOverdue
                        }
                    })
                );
            }
        }

        if (updatedItems.length > 0) {
            await Promise.all(updatedItems);
        }

        return NextResponse.json({
            message: `Processed ${receivables.length} receivables. Updated ${updatedItems.length}.`,
            timestamp: now.toISOString(),
        });
    } catch (error: any) {
        console.error('[cron-receivables] Error processing receivable assets:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
