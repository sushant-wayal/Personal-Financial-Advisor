import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { calculateCurrentBalance } from "@/src/services/analytics";

export async function GET() {
    try {
        const ppf = await prisma.pPFAccount.findMany();
        const epf = await prisma.ePFAccount.findMany();
        const fd = await prisma.fDAccount.findMany();
        const rd = await prisma.rDAccount.findMany();
        const vehicle = await prisma.vehicleAsset.findMany();
        const plot = await prisma.plotAsset.findMany();
        const independentProperty = await prisma.independentPropertyAsset.findMany();
        const apartment = await prisma.apartmentAsset.findMany();
        const jewellery = await prisma.jewelleryAsset.findMany();
        const receivable = await prisma.receivableAsset.findMany();
        const loan = await prisma.loanLiability.findMany();
        const creditCard = await prisma.creditCardLiability.findMany();
        const bnpl = await prisma.bnplLiability.findMany();
        const borrowed = await prisma.borrowedLiability.findMany();
        const mutualFund = await prisma.mutualFund.findMany();
        const stock = await prisma.stock.findMany();
        const bankBalance = await calculateCurrentBalance();

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
