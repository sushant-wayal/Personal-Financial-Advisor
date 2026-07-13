import { NextResponse } from 'next/server';
import prisma from '@/src/lib/prisma';

export const maxDuration = 60;

export async function GET(request: Request) {
    try {
        const authHeader = request.headers.get('authorization');
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const borrowings = await prisma.borrowedLiability.findMany({
            where: { isClosed: false }
        });
        
        if (borrowings.length === 0) {
            return NextResponse.json({ message: 'No active borrowed liabilities found' });
        }

        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        const currentDate = now.getDate();

        const updatedBorrowings = [];

        for (const borrowed of borrowings) {
            if (borrowed.outstandingAmount <= 0) continue;

            if (borrowed.nextRepaymentDate) {
                const repaymentDate = new Date(borrowed.nextRepaymentDate);
                
                // If today is the repayment date
                if (
                    repaymentDate.getFullYear() === currentYear &&
                    repaymentDate.getMonth() === currentMonth &&
                    repaymentDate.getDate() === currentDate
                ) {
                    let newOutstanding = borrowed.outstandingAmount;

                    // 1. Calculate Interest
                    if (borrowed.interestRate > 0) {
                        let interestFactor = 0;
                        if (borrowed.repaymentFrequency === "MONTHLY") {
                            interestFactor = 1 / 12;
                        } else if (borrowed.repaymentFrequency === "QUARTERLY") {
                            interestFactor = 3 / 12;
                        } else if (borrowed.repaymentFrequency === "ONE_TIME" && borrowed.borrowDate) {
                            // Calculate daily interest from borrow date to today
                            const borrowDateObj = borrowed.borrowDate;
                            const daysDiff = Math.max(1, Math.ceil((now.getTime() - borrowDateObj.getTime()) / (1000 * 3600 * 24)));
                            interestFactor = daysDiff / 365;
                        }

                        const interestAmount = borrowed.outstandingAmount * (borrowed.interestRate / 100) * interestFactor;
                        newOutstanding += interestAmount;
                    }

                    // 2. Advance the Next Repayment Date (Do NOT auto-deduct the installment)
                    let newRepaymentDate = new Date(repaymentDate);
                    if (borrowed.repaymentFrequency === "MONTHLY") {
                        newRepaymentDate.setMonth(newRepaymentDate.getMonth() + 1);
                    } else if (borrowed.repaymentFrequency === "QUARTERLY") {
                        newRepaymentDate.setMonth(newRepaymentDate.getMonth() + 3);
                    } else {
                        newRepaymentDate = null as any; // ONE_TIME does not repeat
                    }

                    updatedBorrowings.push(
                        prisma.borrowedLiability.update({
                            where: { id: borrowed.id },
                            data: {
                                outstandingAmount: newOutstanding,
                                nextRepaymentDate: newRepaymentDate
                            }
                        })
                    );
                }
            } else {
                // If there's no nextRepaymentDate, it might be ONE_TIME with no specific due date set.
                // In that case, interest could be calculated when closed manually, but for now we do nothing.
            }
        }

        if (updatedBorrowings.length > 0) {
            await Promise.all(updatedBorrowings);
        }

        return NextResponse.json({
            message: `Processed ${borrowings.length} borrowed liabilities. Added interest / advanced date for ${updatedBorrowings.length} liabilities.`,
            timestamp: now.toISOString(),
        });
    } catch (error: any) {
        console.error('[cron-borrowed] Error processing borrowed liabilities:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
