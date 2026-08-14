import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";

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
            profile
        ] = await Promise.all([
            prisma.pPFAccount.findMany({ select: { id: true, currentWorth: true, currentBalance: true } }),
            prisma.ePFAccount.findMany({ select: { id: true, currentWorth: true, currentBalance: true } }),
            prisma.fDAccount.findMany({ select: { id: true, bankName: true, currentWorth: true, principalAmount: true } }),
            prisma.rDAccount.findMany({ select: { id: true, bankName: true, currentWorth: true, currentTotalDeposits: true } }),
            prisma.vehicleAsset.findMany({ select: { id: true, brand: true, modelName: true, currentWorth: true, purchasePrice: true } }),
            prisma.plotAsset.findMany({ select: { id: true, locality: true, city: true, currentWorth: true, purchasePrice: true } }),
            prisma.independentPropertyAsset.findMany({ select: { id: true, locality: true, city: true, currentWorth: true, purchasePrice: true } }),
            prisma.apartmentAsset.findMany({ select: { id: true, locality: true, city: true, currentWorth: true, purchasePrice: true } }),
            prisma.jewelleryAsset.findMany({ select: { id: true, currentWorth: true, purchasePrice: true } }),
            prisma.receivableAsset.findMany({ select: { id: true, currentWorth: true, principalAmount: true } }),
            prisma.loanLiability.findMany({ select: { id: true, outstandingBalance: true } }),
            prisma.creditCardLiability.findMany({ select: { id: true, currentOutstanding: true } }),
            prisma.bnplLiability.findMany({ select: { id: true, currentOutstanding: true } }),
            prisma.borrowedLiability.findMany({ select: { id: true, outstandingAmount: true } }),
            prisma.mutualFund.findMany({ select: { id: true, currentWorth: true, currentUnits: true, currentNav: true } }),
            prisma.stock.findMany({ select: { id: true, currentWorth: true, currentQuantity: true, currentPrice: true } }),
            prisma.financialProfile.findFirst({ select: { balance: true } }),
        ]);

        const bankBalance = profile?.balance ?? 0;

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
        totalAssets += stock.reduce((sum, item) => sum + ((item as any).currentWorth ?? (((item as any).currentQuantity || 0) * ((item as any).currentPrice || 0))), 0);

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
