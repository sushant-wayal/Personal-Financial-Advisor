import { NextResponse } from 'next/server';
import prisma from '@/src/lib/prisma';

export const maxDuration = 300;

export async function GET(request: Request) {
    try {
        const authHeader = request.headers.get('authorization');
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const accounts = await prisma.rDAccount.findMany({
            where: { isMatured: false }
        });
        
        if (accounts.length === 0) {
            return NextResponse.json({ message: 'No active RD accounts found' });
        }

        const now = new Date();
        const updatedAccounts = [];

        for (const account of accounts) {
            let isMatured = account.isMatured;
            let currentTotalDeposits = account.currentTotalDeposits;

            // Cap elapsed time at maturity date
            const endDate = now >= account.maturityDate ? account.maturityDate : now;
            
            // 1. Calculate Exact Historical Deposit Dates
            // This prevents drift or double-counting if the cron job runs multiple times or is missed.
            const startYear = account.startDate.getFullYear();
            const startMonth = account.startDate.getMonth();
            const endYear = endDate.getFullYear();
            const endMonth = endDate.getMonth();
            
            const totalMonthsPassed = (endYear - startYear) * 12 + (endMonth - startMonth);
            
            const depositDates: Date[] = [];
            for (let i = 0; i <= totalMonthsPassed; i++) {
                // Determine the correct date for this month's instalment
                const depositDate = new Date(startYear, startMonth + i, account.rdDepositDay);
                
                // Ensure depositDate is >= startDate and <= endDate (to avoid future instalments)
                if (depositDate >= account.startDate && depositDate <= endDate) {
                    depositDates.push(depositDate);
                }
            }

            currentTotalDeposits = depositDates.length * account.monthlyDepositAmount;

            // 2. Daily Worth Calculation
            let newWorth = 0;
            let n = 4; // QUARTERLY by default
            if (account.compoundingFrequency === "MONTHLY") n = 12;
            if (account.compoundingFrequency === "HALF_YEARLY") n = 2;
            if (account.compoundingFrequency === "YEARLY") n = 1;
            
            const r = account.annualInterestRate / 100;

            for (const dDate of depositDates) {
                const elapsedMs = endDate.getTime() - dDate.getTime();
                const t = Math.max(0, elapsedMs / (1000 * 60 * 60 * 24 * 365.25));
                newWorth += account.monthlyDepositAmount * Math.pow(1 + r / n, n * t);
            }

            // 3. Maturity Check
            if (now >= account.maturityDate) {
                isMatured = true;
                console.info(`[cron-rd] RD ${account.id} has matured. Worth capped at ${newWorth}`);
            }

            if (
                Math.abs(newWorth - account.currentWorth) > 0.01 || 
                currentTotalDeposits !== account.currentTotalDeposits ||
                isMatured !== account.isMatured
            ) {
                updatedAccounts.push(
                    prisma.rDAccount.update({
                        where: { id: account.id },
                        data: {
                            currentWorth: newWorth,
                            currentTotalDeposits: currentTotalDeposits,
                            isMatured: isMatured
                        }
                    })
                );
            }
        }

        if (updatedAccounts.length > 0) {
            await Promise.all(updatedAccounts);
        }

        return NextResponse.json({
            message: `Processed ${accounts.length} active RD accounts. Updated ${updatedAccounts.length}.`,
            timestamp: now.toISOString(),
        });
    } catch (error: any) {
        console.error('[cron-rd] Error processing RD accounts:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
