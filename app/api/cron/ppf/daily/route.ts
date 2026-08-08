import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";

export async function GET(_req: Request) {
    try {
        console.info("[cron] Starting daily PPF update");

        const accounts = await prisma.pPFAccount.findMany();

        if (accounts.length === 0) {
            console.info("[cron] No PPF accounts found. Exiting.");
            return NextResponse.json({ ok: true, message: "No active PPF accounts" }, { status: 200 });
        }

        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth(); // 0-11
        const date = now.getDate(); // 1-31

        // Determine if today is the last day of the month
        const nextDay = new Date(year, month, date + 1);
        const isLastDayOfMonth = nextDay.getMonth() !== month;

        // Determine if today is March 31st (Month is 2 since Jan=0)
        const isMarch31 = month === 2 && date === 31;

        // Determine Quarter Information
        const currentQuarter = Math.floor(month / 3);
        const isQuarterStartMonth = month % 3 === 0;

        let fetchedRate: number | null = null;
        let fetchAttempted = false;

        const updatedAccounts = [];

        for (const account of accounts) {
            let newMonthlyMin = account.monthlyMinimumBalance;
            let newAccruedInterest = account.accruedInterest;
            let newBalance = account.currentBalance;
            let newInterestRate = account.currentInterestRate;
            let newFetchDate = account.lastInterestRateFetchDate;

            // --- Gemini Interest Rate Fetch Logic ---
            if (isQuarterStartMonth) {
                let shouldFetch = true;
                if (newFetchDate) {
                    const lastFetchDate = new Date(newFetchDate);
                    const lastFetchQuarter = Math.floor(lastFetchDate.getMonth() / 3);
                    if (lastFetchDate.getFullYear() === year && lastFetchQuarter === currentQuarter) {
                        shouldFetch = false;
                    }
                }

                if (shouldFetch) {
                    if (!fetchAttempted) {
                        fetchAttempted = true;
                        try {
                            const { generateText } = await import("@/src/services/gemini");
                            const currentQuarterName = `${now.toLocaleString('default', { month: 'short' })}-${new Date(year, month + 2).toLocaleString('default', { month: 'short' })} ${year}`;
                            const prompt = `What is the officially applicable Public Provident Fund (PPF) interest rate in India for the quarter ${currentQuarterName}? 
                            Respond ONLY with a JSON object. If the government has not yet issued any circular or notification for this specific quarter (neither changing nor maintaining the rate), return rate as 0. If they announced it remains unchanged, return the actual rate.
                            Format: { "rate": 7.1, "effectiveFrom": "YYYY-MM-DD", "quarter": "${currentQuarterName}", "source": "..." }`;

                            console.info(`[cron-ppf] Prompting Gemini for PPF rate JSON: ${prompt}`);
                            const geminiResponse = await generateText(prompt, {
                                enableSearch: true
                            });
                            
                            const rawText = geminiResponse.text.trim();
                            const jsonMatch = rawText.match(/\{[\s\S]*\}/);
                            if (!jsonMatch) throw new Error("No JSON found in response");
                            const text = jsonMatch[0];
                            const data = JSON.parse(text);

                            if (data.rate && data.rate > 0) {
                                const rate = Number(data.rate);
                                const effectiveDate = new Date(data.effectiveFrom);

                                // Validation Rules
                                const isRateValid = rate > 0 && rate <= 15;
                                const isEffectiveQuarterValid = !isNaN(effectiveDate.getTime()) &&
                                    effectiveDate.getFullYear() === year &&
                                    Math.floor(effectiveDate.getMonth() / 3) === currentQuarter;
                                const isQuarterStringValid = typeof data.quarter === 'string' && data.quarter.includes(year.toString());

                                if (isRateValid && isEffectiveQuarterValid && isQuarterStringValid) {
                                    fetchedRate = rate;
                                    console.info(`[cron-ppf] Gemini found valid PPF rate: ${rate}% from ${data.source}`);
                                } else {
                                    console.warn(`[cron-ppf] Gemini returned invalid PPF rate data: ${text}`);
                                }
                            } else {
                                console.info(`[cron-ppf] Gemini indicated PPF rate is not yet announced. Data: ${text}`);
                            }
                        } catch (error) {
                            console.error("[cron-ppf] Failed to fetch rate from Gemini", error);
                        }
                    }

                    if (fetchedRate !== null) {
                        newInterestRate = fetchedRate;
                        newFetchDate = now;
                    }
                }
            }

            // 1. First of the month reset
            if (date === 1) {
                newMonthlyMin = newBalance;
                console.info(`[cron-ppf] Day 1 Reset for ${account.id}: monthlyMinimumBalance = ${newMonthlyMin}`);
            }

            // 2. Daily Tracking removed as MMB is now computed on PPF transactions

            // 3. End of Month Interest Calculation
            if (isLastDayOfMonth) {
                const monthlyInterest = newMonthlyMin * (newInterestRate / 100) / 12;
                newAccruedInterest += monthlyInterest;
                console.info(`[cron-ppf] End of Month Calculation for ${account.id}: added interest ${monthlyInterest} at rate ${newInterestRate}%`);
            }

            // 4. Annual Compounding on March 31st
            if (isMarch31) {
                newBalance += newAccruedInterest;
                console.info(`[cron-ppf] March 31st Compounding for ${account.id}: newBalance = ${newBalance}`);
                newAccruedInterest = 0;
            }

            // Perform Update
            await prisma.pPFAccount.update({
                where: { id: account.id },
                data: {
                    monthlyMinimumBalance: newMonthlyMin,
                    accruedInterest: newAccruedInterest,
                    currentBalance: newBalance,
                    currentWorth: newBalance, // Sync currentWorth for unified tracking
                    currentInterestRate: newInterestRate,
                    lastInterestRateFetchDate: newFetchDate
                }
            });

            updatedAccounts.push({
                id: account.id,
                newBalance,
                newMonthlyMin,
                newAccruedInterest,
                newInterestRate
            });
        }

        return NextResponse.json({ ok: true, updatedAccounts }, { status: 200 });

    } catch (error: any) {
        console.error("[cron] PPF daily update failed", error);
        return NextResponse.json({ error: error?.message || String(error) }, { status: 500 });
    }
}
