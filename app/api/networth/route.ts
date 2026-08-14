import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { calculateCurrentBalance } from "@/src/services/analytics";

export const dynamic = "force-dynamic";

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
            mutualFund,
            stock,
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
            prisma.mutualFund.findMany(),
            prisma.stock.findMany(),
            calculateCurrentBalance(),
        ]);

        const assets = {
            "Bank Balance": [{ id: "bank_balance", bankName: "Liquid Cash", currentWorth: bankBalance }],
            pPFAccount: ppf,
            ePFAccount: epf,
            fDAccount: fd,
            rDAccount: rd,
            vehicleAsset: vehicle,
            plotAsset: plot,
            independentPropertyAsset: independentProperty,
            apartmentAsset: apartment,
            jewelleryAsset: jewellery,
            receivableAsset: receivable,
            mutualFund,
            stock
        };

        const liabilities = {
            loanLiability: loan,
            creditCardLiability: creditCard,
            bnplLiability: bnpl,
            borrowedLiability: borrowed
        };

        // Calculate totals
        let totalAssets = bankBalance;
        let totalLiabilities = 0;

        totalAssets += ppf.reduce((sum, item) => sum + (item.currentWorth ?? item.currentBalance), 0);
        totalAssets += epf.reduce((sum, item) => sum + (item.currentWorth ?? item.currentBalance), 0);
        totalAssets += fd.reduce((sum, item) => sum + (item.currentWorth ?? item.principalAmount), 0);
        totalAssets += rd.reduce((sum, item) => sum + (item.currentWorth ?? item.currentTotalDeposits), 0);
        totalAssets += vehicle.reduce((sum, item) => sum + (item.currentWorth ?? (item.purchasePrice || 0)), 0);
        totalAssets += plot.reduce((sum, item) => sum + (item.currentWorth ?? (item.purchasePrice || 0)), 0);
        totalAssets += independentProperty.reduce((sum, item) => sum + (item.currentWorth ?? (item.purchasePrice || 0)), 0);
        totalAssets += apartment.reduce((sum, item) => sum + (item.currentWorth ?? (item.purchasePrice || 0)), 0);
        totalAssets += jewellery.reduce((sum, item) => sum + (item.currentWorth ?? (item.purchasePrice || 0)), 0);
        totalAssets += receivable.reduce((sum, item) => sum + (item.currentWorth ?? item.principalAmount), 0);
        totalAssets += mutualFund.reduce((sum, item) => sum + (item.currentWorth ?? ((item.currentUnits || 0) * (item.currentNav || 0))), 0);
        totalAssets += stock.reduce((sum, item) => sum + (item.currentWorth ?? ((item.currentQuantity || 0) * (item.currentPrice || 0))), 0);

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
