import { NextResponse } from 'next/server';
import prisma from '@/src/lib/prisma';

export const maxDuration = 60;

export async function GET(request: Request) {
    try {
        const authHeader = request.headers.get('authorization');
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const bnpls = await prisma.bnplLiability.findMany({
            where: { isClosed: false }
        });
        
        if (bnpls.length === 0) {
            return NextResponse.json({ message: 'No active BNPL liabilities found' });
        }

        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        const currentDate = now.getDate();
        
        // Helper to get the last day of the current month
        const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

        const updatedBnpls = [];

        for (const bnpl of bnpls) {
            if (bnpl.currentOutstanding <= 0) continue;

            const effectivePaymentDate = Math.min(bnpl.paymentDueDay, lastDayOfMonth);

            if (currentDate === effectivePaymentDate) {
                // Prevent double deduction in the same month
                if (bnpl.lastPaymentDeductionDate) {
                    const lastPaymentDate = new Date(bnpl.lastPaymentDeductionDate);
                    if (
                        lastPaymentDate.getFullYear() === currentYear &&
                        lastPaymentDate.getMonth() === currentMonth
                    ) {
                        continue; // Already processed this month
                    }
                }

                // 1. Calculate Monthly Interest (if any)
                let monthlyInterestAmount = 0;
                if (bnpl.interestRate > 0) {
                    const monthlyInterestRate = bnpl.interestRate / 100 / 12;
                    monthlyInterestAmount = bnpl.currentOutstanding * monthlyInterestRate;
                }

                // 2. Calculate Principal Repaid via Auto-Debit (Assuming success)
                let principalRepaid = bnpl.monthlyInstallment - monthlyInterestAmount;
                if (principalRepaid < 0) principalRepaid = 0; // Prevent negative amortization

                // 3. Update Balance
                let newBalance = bnpl.currentOutstanding - principalRepaid;
                let isClosed = false;

                if (newBalance <= 0) {
                    newBalance = 0; // Fully paid off
                    isClosed = true;
                }

                // 4. Decrement Installment Count
                let newInstallmentCount = bnpl.remainingInstallments;
                if (newInstallmentCount !== null && newInstallmentCount > 0) {
                    newInstallmentCount -= 1;
                }

                updatedBnpls.push(
                    prisma.bnplLiability.update({
                        where: { id: bnpl.id },
                        data: {
                            currentOutstanding: newBalance,
                            remainingInstallments: newInstallmentCount,
                            lastPaymentDeductionDate: now,
                            isClosed
                        }
                    })
                );
            }
        }

        if (updatedBnpls.length > 0) {
            await Promise.all(updatedBnpls);
        }

        return NextResponse.json({
            message: `Processed ${bnpls.length} BNPLs. Deducted installment for ${updatedBnpls.length} BNPLs.`,
            timestamp: now.toISOString(),
        });
    } catch (error: any) {
        console.error('[cron-bnpl] Error processing BNPL liabilities:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
