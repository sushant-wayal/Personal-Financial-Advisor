import { NextResponse } from 'next/server';
import prisma from '@/src/lib/prisma';

export const maxDuration = 300;

export async function GET(request: Request) {
    try {
        const authHeader = request.headers.get('authorization');
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const accounts = await prisma.fDAccount.findMany({
            where: { isMatured: false }
        });
        
        if (accounts.length === 0) {
            return NextResponse.json({ message: 'No active FD accounts found' });
        }

        const now = new Date();
        const updatedAccounts = [];

        for (const account of accounts) {
            let newWorth = account.currentWorth;
            let isMatured = account.isMatured;

            // Cap elapsed time at maturity date
            const endDate = now >= account.maturityDate ? account.maturityDate : now;
            const elapsedMs = endDate.getTime() - account.startDate.getTime();
            const t = Math.max(0, elapsedMs / (1000 * 60 * 60 * 24 * 365.25)); // years

            if (account.payoutType === "NON_CUMULATIVE") {
                newWorth = account.principalAmount;
            } else {
                // CUMULATIVE
                let n = 4; // QUARTERLY by default
                if (account.compoundingFrequency === "MONTHLY") n = 12;
                if (account.compoundingFrequency === "HALF_YEARLY") n = 2;
                if (account.compoundingFrequency === "YEARLY") n = 1;

                const r = account.annualInterestRate / 100;
                newWorth = account.principalAmount * Math.pow(1 + r / n, n * t);
            }

            // Check if matured today or in the past
            if (now >= account.maturityDate) {
                isMatured = true;
                console.info(`[cron-fd] FD ${account.id} has matured. Worth capped at ${newWorth}`);
            }

            if (newWorth !== account.currentWorth || isMatured !== account.isMatured) {
                updatedAccounts.push(
                    prisma.fDAccount.update({
                        where: { id: account.id },
                        data: {
                            currentWorth: newWorth,
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
            message: `Processed ${accounts.length} active FD accounts. Updated ${updatedAccounts.length}.`,
            timestamp: now.toISOString(),
        });
    } catch (error: any) {
        console.error('[cron-fd] Error processing FD accounts:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
