import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { calculateCurrentBalance } from "@/src/services/analytics";

export async function GET() {
    try {
        const [
            ppf,
            epf,
            fd,
            rd,
            vehicle,
            plot,
            independentProperty,
            apartment,
            jewellery,
            receivable,
            loan,
            creditCard,
            bnpl,
            borrowed,
            bankBalance
        ] = await Promise.all([
            prisma.pPFAccount.findMany(),
            prisma.ePFAccount.findMany(),
            prisma.fDAccount.findMany(),
            prisma.rDAccount.findMany(),
            prisma.vehicleAsset.findMany(),
            prisma.plotAsset.findMany(),
            prisma.independentPropertyAsset.findMany(),
            prisma.apartmentAsset.findMany(),
            prisma.jewelleryAsset.findMany(),
            prisma.receivableAsset.findMany(),
            prisma.loanLiability.findMany(),
            prisma.creditCardLiability.findMany(),
            prisma.bnplLiability.findMany(),
            prisma.borrowedLiability.findMany(),
            calculateCurrentBalance(),
        ]);

        const assets = {
            "Bank Balance": [{ id: "bank_balance", bankName: "Liquid Cash", currentWorth: bankBalance }],
            ppf,
            epf,
            fd,
            rd,
            vehicle,
            plot,
            independentProperty,
            apartment,
            jewellery,
            receivable
        };

        const liabilities = {
            loan,
            creditCard,
            bnpl,
            borrowed
        };

        // Calculate totals
        let totalAssets = bankBalance;
        let totalLiabilities = 0;

        totalAssets += ppf.reduce((sum, item) => sum + (item.currentWorth ?? item.currentBalance), 0);
        totalAssets += epf.reduce((sum, item) => sum + (item.currentWorth ?? item.currentBalance), 0);
        totalAssets += fd.reduce((sum, item) => sum + (item.currentWorth ?? item.principalAmount), 0);
        totalAssets += rd.reduce((sum, item) => sum + (item.currentWorth ?? item.currentTotalDeposits), 0);
        totalAssets += vehicle.reduce((sum, item) => sum + (item.currentWorth ?? item.purchasePrice), 0);
        totalAssets += plot.reduce((sum, item) => sum + (item.currentWorth ?? item.purchasePrice), 0);
        totalAssets += independentProperty.reduce((sum, item) => sum + (item.currentWorth ?? item.purchasePrice), 0);
        totalAssets += apartment.reduce((sum, item) => sum + (item.currentWorth ?? item.purchasePrice), 0);
        totalAssets += jewellery.reduce((sum, item) => sum + (item.currentWorth ?? (item.purchasePrice || 0)), 0);
        totalAssets += receivable.reduce((sum, item) => sum + (item.currentWorth ?? item.principalAmount), 0);

        totalLiabilities += loan.reduce((sum, item) => sum + item.outstandingBalance, 0);
        totalLiabilities += creditCard.reduce((sum, item) => sum + item.currentOutstanding, 0);
        totalLiabilities += bnpl.reduce((sum, item) => sum + item.currentOutstanding, 0);
        totalLiabilities += borrowed.reduce((sum, item) => sum + item.outstandingAmount, 0);

        return NextResponse.json({
            assets,
            liabilities,
            totals: {
                assets: totalAssets,
                liabilities: totalLiabilities,
                netWorth: totalAssets - totalLiabilities
            }
        });
    } catch (e: any) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
