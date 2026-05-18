import { describe, it, expect } from 'vitest';
import { deterministicParse } from '../src/services/transactionParser';
import { autoCategorize } from '../src/services/categorizer';

function expectDate(value: string | Date | undefined, year: number, month: number, day: number) {
    const d = new Date(value as Date);
    expect(d.getFullYear()).toBe(year);
    expect(d.getMonth() + 1).toBe(month);
    expect(d.getDate()).toBe(day);
}

function expectTime(value: string | Date | undefined, hour: number, minute: number, second: number) {
    const d = new Date(value as Date);
    expect(d.getHours()).toBe(hour);
    expect(d.getMinutes()).toBe(minute);
    expect(d.getSeconds()).toBe(second);
}

describe('transactionParser', () => {
    it('parses INR amount and detects merchant', () => {
        const raw = 'Rs. 1,234.56 debited from your a/c at ACME Store on 12/05/2024. Ref: TXN1234';
        const res = deterministicParse(raw as string);
        expect(res.amount).toBeGreaterThan(0);
        expect(res.merchant).toBe('Acme Store');
        expect(res.confidence).toBeGreaterThan(0.5);
        expect(res.type).toBe('DEBIT');
        expectDate(res.timestamp, 2024, 5, 12);
    });

    it('detects salary with high confidence', () => {
        const raw = 'Salary credited on 01-05-2024: INR 50,000';
        const res = deterministicParse(raw as string);
        expect(res.transactionType).toBe('SALARY');
        expect(res.type).toBe('SALARY');
    });

    it('does not use banks or UPI providers as spending merchants', () => {
        const raw = 'Dear Customer, Greetings from HDFC Bank! Rs.245 debited from account 5662 to VPA q123@ybl ZOMATO on 06-05-26. Ref TXN123';
        const res = deterministicParse(raw);
        expect(res.merchant).toBe('Zomato');
        expect(res.paymentMethod).toBe('UPI');
        expect(res.bankName).toBe('HDFC');
        expect(res.category).toBeUndefined();
        expectDate(res.timestamp, 2026, 5, 6);
    });

    it('normalizes payment-provider branded merchants to the real merchant when possible', () => {
        const raw = 'Paid to AMAZON PAY via UPI on 29-04-26 for INR 799';
        const res = deterministicParse(raw);
        expect(res.merchant).toBe('Amazon');
        expect(res.paymentMethod).toBe('UPI');
        expectDate(res.timestamp, 2026, 4, 29);
    });

    it('parses debit card date formats with day month year and time', () => {
        const raw = 'Rs.5620.00 is debited from your HDFC Bank Debit Card ending 9839 at PAYTM TRAVEL on 11 May, 2026 at 21:58:17.';
        const res = deterministicParse(raw);
        expect(res.amount).toBe(5620);
        expect(res.merchant).toBe('Paytm Travel');
        expect(res.paymentMethod).toBe('Card');
        expect(res.bankName).toBe('HDFC');
        expectDate(res.timestamp, 2026, 5, 11);
        expectTime(res.timestamp, 21, 58, 17);
    });

    it('extracts parenthesized VPA payees as merchants', () => {
        const cases = [
            ['Rs.1500.00 is debited from your account ending 5662 towards VPA q001999218@ybl (RAINBOW WATER WORLD WATER PARK) on 16-05-26.', 'Rainbow Water World Water Park'],
            ['Rs.380.00 is debited from your account ending 5662 towards VPA q818365938@ybl (RAJENDRA Z CHEMATE) on 15-05-26.', 'Rajendra Z Chemate'],
            ['Rs.140.00 is debited from your account ending 5662 towards VPA q048139517@ybl (AROMA SUPER MARKET) on 15-05-26.', 'Aroma Super Market'],
            ['Rs.130.00 is debited from your account ending 5662 towards VPA q764214012@ybl (OM SAI DAIRY AND BAKERS) on 15-05-26.', 'Om Sai Dairy And Bakers'],
            ['Rs.120.00 is debited from your account ending 5662 towards VPA q420536431@ybl (JAGDAMBA FOODS) on 14-05-26.', 'Jagdamba Foods'],
            ['Rs.120.00 is debited from your account ending 5662 towards VPA q221523202@ybl (SHREE FARSAN AND SWEETS) on 13-05-26.', 'Shree Farsan And Sweets'],
            ['Rs.188.00 is debited from your account ending 5662 towards VPA gpay-11244232954@okbizaxis (ASARA TRADERS) on 13-05-26.', 'Asara Traders'],
        ];

        for (const [raw, merchant] of cases) {
            expect(deterministicParse(raw).merchant).toBe(merchant);
        }
    });

    it('extracts structured sender names from credit messages', () => {
        const webUpi = `We're writing to inform you that Rs.2361.44 has been successfully credited to your HDFC Bank account ending in 5662.

Transaction Details:
a. Date: 15-05-26
b. Sender: WEB UPI (VPA: paytm-651536@ptybl)
c. UPI Reference No.: 650109213680`;
        const person = `We're writing to inform you that Rs.10000.00 has been successfully credited to your HDFC Bank account ending in 5662.

Transaction Details:
a. Date: 11-05-26
b. Sender: SUNDAR TULSHIDAS WAYAL (VPA: wayalst@okhdfcbank)
c. UPI Reference No.: 122981935463`;

        expect(deterministicParse(webUpi).merchant).toBe('Web UPI');
        expect(deterministicParse(person).merchant).toBe('Sundar Tulshidas Wayal');
        expectDate(deterministicParse(webUpi).timestamp, 2026, 5, 15);
    });
});

describe('categorizer heuristics', () => {
    it('classifies common extracted merchants by spending intent', async () => {
        await expect(autoCategorize('Paytm Travel', { rawText: 'at PAYTM TRAVEL', transactionType: 'DEBIT' })).resolves.toMatchObject({ category: 'Transport' });
        await expect(autoCategorize('Rainbow Water World Water Park', { transactionType: 'DEBIT' })).resolves.toMatchObject({ category: 'Entertainment' });
        await expect(autoCategorize('Web UPI', { rawText: 'successfully credited Sender: WEB UPI', transactionType: 'CREDIT' })).resolves.toMatchObject({ category: 'Refund' });
        await expect(autoCategorize('Aroma Super Market', { transactionType: 'DEBIT' })).resolves.toMatchObject({ category: 'Groceries' });
        await expect(autoCategorize('OM SAI Dairy And Bakers', { transactionType: 'DEBIT' })).resolves.toMatchObject({ category: 'Food' });
        await expect(autoCategorize('Jagdamba Foods', { transactionType: 'DEBIT' })).resolves.toMatchObject({ category: 'Food' });
        await expect(autoCategorize('Shree Farsan And Sweets', { transactionType: 'DEBIT' })).resolves.toMatchObject({ category: 'Food' });
        await expect(autoCategorize('Asara Traders', { transactionType: 'DEBIT' })).resolves.toMatchObject({ category: 'Groceries' });
    });
});
