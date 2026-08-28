import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const rawRes = await prisma.$queryRaw<Array<{ data: any }>>`
            SELECT json_build_object(
                'ppf', (SELECT COALESCE(json_agg(t), '[]'::json) FROM (SELECT "id", "currentWorth", "currentBalance", "currentInterestRate" FROM "PPFAccount") t),
                'epf', (SELECT COALESCE(json_agg(t), '[]'::json) FROM (SELECT "id", "currentWorth", "currentBalance", "currentInterestRate" FROM "EPFAccount") t),
                'fd', (SELECT COALESCE(json_agg(t), '[]'::json) FROM (SELECT "id", "bankName", "currentWorth", "principalAmount", "annualInterestRate", "payoutType", "maturityDate" FROM "FDAccount") t),
                'rd', (SELECT COALESCE(json_agg(t), '[]'::json) FROM (SELECT "id", "bankName", "currentWorth", "currentTotalDeposits", "monthlyDepositAmount", "annualInterestRate", "maturityDate" FROM "RDAccount") t),
                'vehicle', (SELECT COALESCE(json_agg(t), '[]'::json) FROM (SELECT "id", "type", "brand", "modelName", "variant", "manufacturingYear", "fuelType", "currentWorth", "purchasePrice" FROM "VehicleAsset") t),
                'plot', (SELECT COALESCE(json_agg(t), '[]'::json) FROM (SELECT "id", "locality", "city", "state", "country", "area", "areaUnit", "currentWorth", "purchasePrice" FROM "PlotAsset") t),
                'independentProperty', (SELECT COALESCE(json_agg(t), '[]'::json) FROM (SELECT "id", "locality", "city", "state", "country", "builtUpArea", "landArea", "landAreaUnit", "currentWorth", "purchasePrice" FROM "IndependentPropertyAsset") t),
                'apartment', (SELECT COALESCE(json_agg(t), '[]'::json) FROM (SELECT "id", "projectName", "builder", "bhk", "builtUpArea", "locality", "city", "currentWorth", "purchasePrice" FROM "ApartmentAsset") t),
                'jewellery', (SELECT COALESCE(json_agg(t), '[]'::json) FROM (SELECT "id", "metalType", "purity", "netWeight", "weightUnit", "currentWorth", "purchasePrice" FROM "JewelleryAsset") t),
                'receivable', (SELECT COALESCE(json_agg(t), '[]'::json) FROM (SELECT "id", "name", "category", "principalAmount", "interestRate", "expectedReturnDate", "currentWorth" FROM "ReceivableAsset") t),
                'loan', (SELECT COALESCE(json_agg(t), '[]'::json) FROM (SELECT "id", "loanType", "outstandingBalance", "interestRate", "emiAmount", "emiDebitDate" FROM "LoanLiability") t),
                'creditCard', (SELECT COALESCE(json_agg(t), '[]'::json) FROM (SELECT "id", "currentOutstanding", "paymentDueDay", "annualInterestRate", "statementGenerationDay" FROM "CreditCardLiability") t),
                'bnpl', (SELECT COALESCE(json_agg(t), '[]'::json) FROM (SELECT "id", "provider", "currentOutstanding", "monthlyInstallment", "paymentDueDay" FROM "BnplLiability") t),
                'borrowed', (SELECT COALESCE(json_agg(t), '[]'::json) FROM (SELECT "id", "lenderName", "outstandingAmount", "interestRate", "repaymentFrequency" FROM "BorrowedLiability") t),
                'mutualFund', (SELECT COALESCE(json_agg(t), '[]'::json) FROM (SELECT "id", "schemeName", "schemeCode", "isin", "planType", "option", "currentWorth", "currentUnits", "currentNav" FROM "MutualFund") t),
                'stock', (SELECT COALESCE(json_agg(t), '[]'::json) FROM (SELECT "id", "symbol", "exchange", "currentWorth", "currentQuantity", "currentPrice" FROM "Stock") t),
                'balance', (SELECT COALESCE((SELECT "balance" FROM "FinancialProfile" LIMIT 1), 0))
            ) as data;
        `;

        const d = rawRes[0]?.data || {};
        const bankBalance = Number(d.balance || 0);

        const ppf = d.ppf || [];
        const epf = d.epf || [];
        const fd = d.fd || [];
        const rd = d.rd || [];
        const vehicle = d.vehicle || [];
        const plot = d.plot || [];
        const independentProperty = d.independentProperty || [];
        const apartment = d.apartment || [];
        const jewellery = d.jewellery || [];
        const receivable = d.receivable || [];
        const loan = d.loan || [];
        const creditCard = d.creditCard || [];
        const bnpl = d.bnpl || [];
        const borrowed = d.borrowed || [];
        const mutualFund = d.mutualFund || [];
        const stock = d.stock || [];

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

        let totalAssets = bankBalance;
        let totalLiabilities = 0;

        totalAssets += ppf.reduce((sum: number, item: any) => sum + Number(item.currentWorth ?? item.currentBalance ?? 0), 0);
        totalAssets += epf.reduce((sum: number, item: any) => sum + Number(item.currentWorth ?? item.currentBalance ?? 0), 0);
        totalAssets += fd.reduce((sum: number, item: any) => sum + Number(item.currentWorth ?? item.principalAmount ?? 0), 0);
        totalAssets += rd.reduce((sum: number, item: any) => sum + Number(item.currentWorth ?? item.currentTotalDeposits ?? 0), 0);
        totalAssets += vehicle.reduce((sum: number, item: any) => sum + Number(item.currentWorth ?? (item.purchasePrice || 0)), 0);
        totalAssets += plot.reduce((sum: number, item: any) => sum + Number(item.currentWorth ?? (item.purchasePrice || 0)), 0);
        totalAssets += independentProperty.reduce((sum: number, item: any) => sum + Number(item.currentWorth ?? (item.purchasePrice || 0)), 0);
        totalAssets += apartment.reduce((sum: number, item: any) => sum + Number(item.currentWorth ?? (item.purchasePrice || 0)), 0);
        totalAssets += jewellery.reduce((sum: number, item: any) => sum + Number(item.currentWorth ?? (item.purchasePrice || 0)), 0);
        totalAssets += receivable.reduce((sum: number, item: any) => sum + Number(item.currentWorth ?? item.principalAmount ?? 0), 0);
        totalAssets += mutualFund.reduce((sum: number, item: any) => sum + Number(item.currentWorth ?? ((item.currentUnits || 0) * (item.currentNav || 0))), 0);
        totalAssets += stock.reduce((sum: number, item: any) => sum + Number(item.currentWorth ?? ((item.currentQuantity || 0) * (item.currentPrice || 0))), 0);

        totalLiabilities += loan.reduce((sum: number, item: any) => sum + Number(item.outstandingBalance ?? 0), 0);
        totalLiabilities += creditCard.reduce((sum: number, item: any) => sum + Number(item.currentOutstanding ?? 0), 0);
        totalLiabilities += bnpl.reduce((sum: number, item: any) => sum + Number(item.currentOutstanding ?? 0), 0);
        totalLiabilities += borrowed.reduce((sum: number, item: any) => sum + Number(item.outstandingAmount ?? 0), 0);

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
