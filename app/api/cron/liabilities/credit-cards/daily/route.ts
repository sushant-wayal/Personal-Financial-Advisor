import { NextResponse } from 'next/server';
import prisma from '@/src/lib/prisma';

export const maxDuration = 60;

export async function GET(request: Request) {
    try {
        const authHeader = request.headers.get('authorization');
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const cards = await prisma.creditCardLiability.findMany();
        
        if (cards.length === 0) {
            return NextResponse.json({ message: 'No active credit card liabilities found' });
        }

        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        const currentDate = now.getDate();
        
        const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

        const updatedCards = [];

        for (const card of cards) {
            let currentOutstanding = card.currentOutstanding;
            let lastStatementAmount = card.lastStatementAmount;
            let amountPaidSinceStatement = card.amountPaidSinceStatement;
            let lastStatementDate = card.lastStatementDate;
            let updateNeeded = false;

            const effectiveStatementDay = Math.min(card.statementGenerationDay, lastDayOfMonth);
            const effectiveDueDay = Math.min(card.paymentDueDay, lastDayOfMonth);

            // 1. STATEMENT GENERATION DAY
            if (currentDate === effectiveStatementDay) {
                // Prevent duplicate statement generation if ran twice
                const alreadyGeneratedToday = lastStatementDate && 
                    lastStatementDate.getFullYear() === currentYear &&
                    lastStatementDate.getMonth() === currentMonth &&
                    lastStatementDate.getDate() === currentDate;

                if (!alreadyGeneratedToday) {
                    lastStatementAmount = currentOutstanding;
                    amountPaidSinceStatement = 0;
                    lastStatementDate = now;
                    updateNeeded = true;

                    // Annual Fee check
                    if (card.annualFeeMonth && card.annualFeeMonth === (currentMonth + 1)) {
                        const fee = card.annualFee;
                        const gst = fee * (card.gstRateOnFees / 100);
                        currentOutstanding += (fee + gst);
                    }
                }
            }

            // 2. PAYMENT DUE DAY
            if (currentDate === effectiveDueDay) {
                // If there's an outstanding statement balance
                if (lastStatementAmount > 0) {
                    const minimumPayment = lastStatementAmount * (card.minimumPaymentPercentage / 100);
                    
                    // Late Fee
                    if (amountPaidSinceStatement < minimumPayment) {
                        const lateFee = card.latePaymentFee;
                        const gst = lateFee * (card.gstRateOnFees / 100);
                        currentOutstanding += (lateFee + gst);
                        updateNeeded = true;
                    }

                    // Interest Calculation (Simplified as requested: Remaining * APR / 365 * DaysUntilNextStatement)
                    if (amountPaidSinceStatement < lastStatementAmount) {
                        const remaining = lastStatementAmount - amountPaidSinceStatement;
                        
                        // Find days until next statement
                        const nextStatementDate = new Date(currentYear, currentMonth, card.statementGenerationDay);
                        if (nextStatementDate < now) {
                            nextStatementDate.setMonth(nextStatementDate.getMonth() + 1);
                        }
                        const daysUntilNextStatement = Math.max(1, Math.ceil((nextStatementDate.getTime() - now.getTime()) / (1000 * 3600 * 24)));
                        
                        const baseInterest = remaining * (card.annualInterestRate / 100 / 365) * daysUntilNextStatement;
                        const gst = baseInterest * (card.gstRateOnFees / 100);
                        
                        currentOutstanding += (baseInterest + gst);
                        updateNeeded = true;
                    }

                    // Reset lastStatementAmount because this billing cycle is officially over
                    lastStatementAmount = 0;
                    amountPaidSinceStatement = 0; // It will be reset at statement generation anyway, but good for cleanup
                    updateNeeded = true;
                }
            }

            if (updateNeeded) {
                updatedCards.push(
                    prisma.creditCardLiability.update({
                        where: { id: card.id },
                        data: {
                            currentOutstanding,
                            lastStatementAmount,
                            amountPaidSinceStatement,
                            lastStatementDate
                        }
                    })
                );
            }
        }

        if (updatedCards.length > 0) {
            await Promise.all(updatedCards);
        }

        return NextResponse.json({
            message: `Processed ${cards.length} cards. Updated ${updatedCards.length} cards.`,
            timestamp: now.toISOString(),
        });
    } catch (error: any) {
        console.error('[cron-credit-cards] Error processing credit card liabilities:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
