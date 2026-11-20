import { NextResponse } from 'next/server';
import prisma from '@/src/lib/prisma';

export const maxDuration = 300;

export async function GET(request: Request) {
    try {
        const authHeader = request.headers.get('authorization');
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const accounts = await prisma.ePFAccount.findMany();
        if (accounts.length === 0) {
            return NextResponse.json({ message: 'No EPF accounts found' });
        }

        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth(); 
        const date = now.getDate();
        
        const isEndOfMonth = new Date(year, month + 1, 0).getDate() === date;
        const currentQuarter = Math.floor(month / 3);
        const isQuarterStartMonth = month % 3 === 0;

        const updatedAccounts = [];

        for (const account of accounts) {
            let newBalance = account.currentBalance;
            let newAccruedInterest = account.accruedInterest;
            let newInterestRate = account.currentInterestRate;
            let newFetchDate = account.lastInterestRateFetchDate;

            // --- 1. Monthly Contribution Credit ---
            if (date === account.epfCreditDay) {
                const contribKey = `cron:epf:contrib:${account.id}:${year}-${month + 1}`;
                const alreadyCredited = await prisma.aIMemory.findFirst({ where: { key: contribKey } });
                if (!alreadyCredited) {
                    newBalance += account.monthlyEmployeeContribution + account.monthlyEmployerContribution;
                    await prisma.aIMemory.create({
                        data: {
                            key: contribKey,
                            name: "EPF Monthly Contribution Credit",
                            value: JSON.stringify({ amount: account.monthlyEmployeeContribution + account.monthlyEmployerContribution, date: now.toISOString() }),
                        },
                    });
                    console.info(`[cron-epf] Credited monthly contribution for account ${account.id}. New Balance: ${newBalance}`);
                } else {
                    console.info(`[cron-epf] Monthly contribution for account ${account.id} already credited for ${year}-${month + 1}`);
                }
            }

            // --- 2. End of Month Interest Accrual ---
            if (isEndOfMonth) {
                const accrualKey = `cron:epf:accrual:${account.id}:${year}-${month + 1}`;
                const alreadyAccrued = await prisma.aIMemory.findFirst({ where: { key: accrualKey } });
                if (!alreadyAccrued) {
                    const monthlyInterest = newBalance * (newInterestRate / 100) / 12;
                    newAccruedInterest += monthlyInterest;
                    await prisma.aIMemory.create({
                        data: {
                            key: accrualKey,
                            name: "EPF Monthly Accrual Check",
                            value: JSON.stringify({ monthlyInterest, date: now.toISOString() }),
                        },
                    });
                    console.info(`[cron-epf] Accrued monthly interest for account ${account.id}: ${monthlyInterest}. Total Accrued: ${newAccruedInterest}`);
                } else {
                    console.info(`[cron-epf] Monthly interest for account ${account.id} already accrued for ${year}-${month + 1}`);
                }
            }

            // --- 3. Annual Interest Rate Fetch (Gemini) ---
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
                    try {
                        const { generateText } = await import("@/src/services/gemini");
                        
                        // E.g. if month is Jan (0), FY is (year-1)-(year). If month is April (3), FY is (year)-(year+1).
                        const fyStartYear = month < 3 ? year - 1 : year;
                        const fyString = `FY ${fyStartYear}-${(fyStartYear + 1).toString().slice(2)}`;
                        
                        const prompt = `What is the officially applicable Employees' Provident Fund (EPF) interest rate in India for ${fyString}? 
                        Respond ONLY with a JSON object. If the government has not yet issued any circular or notification for this specific FY, return rate as 0. If they announced it remains unchanged, return the actual rate.
                        Format: { "rate": 8.25, "effectiveFrom": "YYYY-MM-DD", "fy": "${fyString}", "source": "..." }`;

                        console.info(`[cron-epf] Prompting Gemini for EPF rate JSON: ${prompt}`);
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
                            const isRateValid = rate > 0 && rate <= 15;
                            const isFyStringValid = typeof data.fy === 'string' && data.fy.includes(fyStartYear.toString());
                            
                            if (isRateValid && isFyStringValid) {
                                newInterestRate = rate;
                                newFetchDate = now;
                                console.info(`[cron-epf] Updated EPF interest rate to ${rate}% based on Gemini.`);
                            } else {
                                console.warn(`[cron-epf] Gemini returned invalid EPF rate data: ${JSON.stringify(data)}`);
                            }
                        } else {
                            console.info(`[cron-epf] Rate for ${fyString} not yet officially announced.`);
                        }
                    } catch (error: any) {
                        console.error(`[cron-epf] Failed to fetch EPF interest rate from Gemini:`, error.message);
                    }
                }
            }

            // --- 4. Annual Compounding ---
            // Format today's date as MM-DD (e.g., "03-31")
            const todayStr = `${String(month + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
            if (todayStr === account.annualInterestCreditDate) {
                const compoundKey = `cron:epf:compounding:${account.id}:${year}`;
                const alreadyCompounded = await prisma.aIMemory.findFirst({ where: { key: compoundKey } });
                if (!alreadyCompounded) {
                    newBalance += newAccruedInterest;
                    await prisma.aIMemory.create({
                        data: {
                            key: compoundKey,
                            name: "EPF Annual Compounding Check",
                            value: JSON.stringify({ compoundedInterest: newAccruedInterest, date: now.toISOString() }),
                        },
                    });
                    console.info(`[cron-epf] Annual compounding for account ${account.id}. Added ${newAccruedInterest} to balance. New Balance: ${newBalance}`);
                    newAccruedInterest = 0;
                } else {
                    console.info(`[cron-epf] Annual compounding for account ${account.id} already performed for FY ending ${year}`);
                }
            }

            // --- Save Updates ---
            if (
                newBalance !== account.currentBalance ||
                newAccruedInterest !== account.accruedInterest ||
                newInterestRate !== account.currentInterestRate ||
                newFetchDate !== account.lastInterestRateFetchDate
            ) {
                updatedAccounts.push(
                    prisma.ePFAccount.update({
                        where: { id: account.id },
                        data: {
                            currentBalance: newBalance,
                            accruedInterest: newAccruedInterest,
                            currentInterestRate: newInterestRate,
                            lastInterestRateFetchDate: newFetchDate,
                            currentWorth: newBalance
                        }
                    })
                );
            }
        }

        if (updatedAccounts.length > 0) {
            await Promise.all(updatedAccounts);
        }

        return NextResponse.json({
            message: `Processed ${accounts.length} EPF accounts. Updated ${updatedAccounts.length}.`,
            timestamp: now.toISOString(),
        });
    } catch (error: any) {
        console.error('[cron-epf] Error processing EPF accounts:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
