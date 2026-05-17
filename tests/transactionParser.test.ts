import { describe, it, expect } from 'vitest';
import { deterministicParse } from '../src/services/transactionParser';

describe('transactionParser', () => {
    it('parses INR amount and detects merchant', () => {
        const raw = 'Rs. 1,234.56 debited from your a/c at ACME Store on 12/05/2024. Ref: TXN1234';
        const res = deterministicParse(raw as string);
        expect(res.amount).toBeGreaterThan(0);
        expect(res.merchant).toBeDefined();
        expect(res.confidence).toBeGreaterThan(0.5);
        expect(res.type).toBe('DEBIT');
    });

    it('detects salary with high confidence', () => {
        const raw = 'Salary credited on 01-05-2024: INR 50,000';
        const res = deterministicParse(raw as string);
        expect(res.category).toBe('Salary');
        expect(res.confidence).toBeGreaterThan(0.9);
        expect(res.type).toBe('SALARY');
    });
});
