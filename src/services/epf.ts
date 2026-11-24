/**
 * Domain service for Employee Provident Fund (EPF) calculations.
 */

export interface EpfMonthlyCreditParams {
    currentBalance: number;
    monthlyEmployeeContribution: number;
    monthlyEmployerContribution: number;
    currentInterestRate: number;
    accruedInterest?: number;
}

export interface EpfMonthlyCreditResult {
    monthlyInterest: number;
    totalContribution: number;
    balanceBeforeContribution: number;
    newBalance: number;
    newAccruedInterest: number;
}

/**
 * Calculates monthly EPF interest based on annual interest rate
 * and the balance available before that month's contribution credit.
 *
 * @param balanceBeforeContribution EPF balance before monthly contribution
 * @param annualInterestRate Annual interest rate as percentage (e.g. 8.25)
 * @returns Monthly interest credited, rounded to 2 decimal places
 */
export function calculateMonthlyEpfInterest(
    balanceBeforeContribution: number,
    annualInterestRate: number
): number {
    if (!Number.isFinite(balanceBeforeContribution) || balanceBeforeContribution <= 0) {
        return 0;
    }
    if (!Number.isFinite(annualInterestRate) || annualInterestRate <= 0) {
        return 0;
    }

    const monthlyRate = (annualInterestRate / 100) / 12;
    const monthlyInterest = balanceBeforeContribution * monthlyRate;
    return Math.round(monthlyInterest * 100) / 100;
}

/**
 * Computes monthly EPF credit:
 * 1. Folds any leftover legacy accrued interest into the balance.
 * 2. Calculates monthly interest based on balance BEFORE that month's contribution credit.
 * 3. Credits the monthly interest into the balance.
 * 4. Credits monthly employee and employer contributions into the balance.
 */
export function processEpfMonthlyCredit(params: EpfMonthlyCreditParams): EpfMonthlyCreditResult {
    let balance = Number.isFinite(params.currentBalance) ? params.currentBalance : 0;
    const legacyAccrued = Number.isFinite(params.accruedInterest) && (params.accruedInterest ?? 0) > 0 
        ? (params.accruedInterest ?? 0) 
        : 0;
    
    // Fold any legacy accrued interest from previous annual model into the opening balance
    balance += legacyAccrued;

    // Interest is calculated on the balance before this month's contribution
    const balanceBeforeContribution = balance;
    const monthlyInterest = calculateMonthlyEpfInterest(balanceBeforeContribution, params.currentInterestRate);
    
    // Credit monthly interest first
    balance += monthlyInterest;

    // Credit monthly contributions
    const empContrib = Math.max(0, Number.isFinite(params.monthlyEmployeeContribution) ? params.monthlyEmployeeContribution : 0);
    const emplyrContrib = Math.max(0, Number.isFinite(params.monthlyEmployerContribution) ? params.monthlyEmployerContribution : 0);
    const totalContribution = empContrib + emplyrContrib;
    balance += totalContribution;

    return {
        monthlyInterest,
        totalContribution,
        balanceBeforeContribution,
        newBalance: Math.round(balance * 100) / 100,
        newAccruedInterest: 0,
    };
}
