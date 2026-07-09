import { NextResponse } from 'next/server';
import prisma from '@/src/lib/prisma';

export const maxDuration = 60;

export async function GET(request: Request) {
    try {
        const authHeader = request.headers.get('authorization');
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const loans = await prisma.loanLiability.findMany();
        
        if (loans.length === 0) {
            return NextResponse.json({ message: 'No active loan liabilities found' });
        }

        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        const currentDate = now.getDate();
        
        // Helper to get the last day of the current month
        const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

        const updatedLoans = [];

        for (const loan of loans) {
            if (loan.outstandingBalance <= 0) continue;

            // Determine effective EMI date for this month
            // If loan.emiDebitDate is 31, but this month only has 30 days, we trigger on the 30th.
            const effectiveEmiDate = Math.min(loan.emiDebitDate, lastDayOfMonth);

            // Check if today is the EMI date
            if (currentDate === effectiveEmiDate) {
                
                // Prevent double deduction in the same month
                if (loan.lastEmiDeductionDate) {
                    const lastEmiDate = new Date(loan.lastEmiDeductionDate);
                    if (
                        lastEmiDate.getFullYear() === currentYear &&
                        lastEmiDate.getMonth() === currentMonth
                    ) {
                        continue; // Already processed this month
                    }
                }

                // 1. Calculate Monthly Interest (Reducing Balance Method)
                const monthlyInterestRate = loan.interestRate / 100 / 12;
                const monthlyInterestAmount = loan.outstandingBalance * monthlyInterestRate;

                // 2. Calculate Principal Repaid
                let principalRepaid = loan.emiAmount - monthlyInterestAmount;

                // Safety Check: Negative Amortization
                if (principalRepaid < 0) {
                    console.warn(`[cron-loans] Negative amortization detected for loan ${loan.id}. EMI is not covering interest!`);
                    principalRepaid = 0; // Prevent the balance from actually growing if the EMI is just incorrectly entered. 
                    // Alternatively, we could add the unpaid interest to the balance, but standard practice in these trackers is to alert the user.
                }

                // 3. Update Balance
                let newBalance = loan.outstandingBalance - principalRepaid;
                if (newBalance < 0) newBalance = 0; // Loan fully paid off

                // 4. Decrement EMI Count
                let newEmiCount = loan.remainingEmiCount;
                if (newEmiCount !== null && newEmiCount > 0) {
                    newEmiCount -= 1;
                }

                updatedLoans.push(
                    prisma.loanLiability.update({
                        where: { id: loan.id },
                        data: {
                            outstandingBalance: newBalance,
                            remainingEmiCount: newEmiCount,
                            lastEmiDeductionDate: now
                        }
                    })
                );
            }
        }

        if (updatedLoans.length > 0) {
            await Promise.all(updatedLoans);
        }

        return NextResponse.json({
            message: `Processed ${loans.length} loans. Deducted EMI for ${updatedLoans.length} loans.`,
            timestamp: now.toISOString(),
        });
    } catch (error: any) {
        console.error('[cron-loans] Error processing loan liabilities:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
