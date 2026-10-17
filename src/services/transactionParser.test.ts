import { describe, expect, it } from "vitest";
import { deterministicParse, transactionParserUtils } from "./transactionParser";

describe("transactionParser — deterministicParse", () => {
    it("extracts merchant from HDFC email with asterisk-masked VPA and parenthesized merchant", () => {
        const text =
            "HDFC BANK --> Dear Customer, Greetings from HDFC Bank! Rs.908.33 is debited from your account ending 5662 towards VPA ***********tm-3@okicici (RUDRA PRATAP SINGH) on 17-10-26. UPI transaction reference no.: 131464295852.";
        const result = deterministicParse(text);

        expect(result.merchant).toBe("Rudra Pratap Singh");
        expect(result.amount).toBe(908.33);
        expect(result.transactionType).toBe("DEBIT");
        expect(result.bankName).toBe("HDFC");
        expect(result.paymentMethod).toBe("UPI");
        expect(result.confidence).toBeGreaterThan(0.8);
    });

    it("extracts merchant from Juice Pops email with masked VPA", () => {
        const text =
            "HDFC BANK --> Dear Customer, Greetings from HDFC Bank! Rs.100.00 is debited from your account ending 5662 towards VPA ******3113@ybl (Juice pops) on 17-10-26. UPI transaction reference no.: 131463483640.";
        const result = deterministicParse(text);

        expect(result.merchant).toBe("Juice Pops");
        expect(result.amount).toBe(100);
        expect(result.transactionType).toBe("DEBIT");
    });

    it("extracts company merchant with masked VPA (Euronet Services)", () => {
        const text =
            "HDFC BANK --> Dear Customer, Greetings from HDFC Bank! Rs.26.00 is debited from your account ending 5662 towards VPA *********rge2@okpayaxis (Euronet Services India Pvt Ltd) on 17-10-26. UPI transaction reference no.: 131449015109.";
        const result = deterministicParse(text);

        expect(result.merchant).toBe("Euronet Services India Pvt Ltd");
        expect(result.amount).toBe(26);
    });

    it("extracts multi-word uppercase company merchant with masked VPA (Munchmart)", () => {
        const text =
            "HDFC BANK --> Dear Customer, Greetings from HDFC Bank! Rs.257.00 is debited from your account ending 5662 towards VPA *************erpg@axb (MUNCHMART TECHNOLOGIES PRIVATE LIMITED) on 16-10-26. UPI transaction reference no.: 131406057710.";
        const result = deterministicParse(text);

        expect(result.merchant).toBe("Munchmart Technologies Private Limited");
        expect(result.amount).toBe(257);
    });

    it("extracts short brand merchant (SWISH) with long asterisk mask", () => {
        const text =
            "HDFC BANK --> Dear Customer, Greetings from HDFC Bank! Rs.381.00 is debited from your account ending 5662 towards VPA **********************payu@mairtel (SWISH) on 16-10-26. UPI transaction reference no.: 131390992039.";
        const result = deterministicParse(text);

        expect(result.merchant).toBe("Swish");
        expect(result.amount).toBe(381);
    });

    it("extracts individual person with honorific (Mrs SUNANDA SUNDAR WAYAL)", () => {
        const text =
            "HDFC BANK --> Dear Customer, Greetings from HDFC Bank! Rs.10000.00 is debited from your account ending 5662 towards VPA ******6948@ybl (Mrs SUNANDA SUNDAR WAYAL) on 16-10-26. UPI transaction reference no.: 628930350660.";
        const result = deterministicParse(text);

        expect(result.merchant).toBe("Mrs Sunanda Sundar Wayal");
        expect(result.amount).toBe(10000);
    });

    it("extracts Google India Digital Services from masked VPA", () => {
        const text =
            "HDFC BANK --> Dear Customer, Greetings from HDFC Bank! Rs.203.67 is debited from your account ending 5662 towards VPA ***********card@okpayaxis (Google India Digital Services Pvt Ltd) on 16-10-26. UPI transaction reference no.: 628982617467.";
        const result = deterministicParse(text);

        expect(result.merchant).toBe("Google India Digital Services Pvt Ltd");
        expect(result.amount).toBe(203.67);
    });

    it("preserves backward compatibility with legacy unmasked VPAs", () => {
        const text =
            "HDFC BANK --> Dear Customer, Greetings from HDFC Bank! Rs.35.00 is debited from your account ending 5662 towards VPA q224153113@ybl (Juice pops) on 12-10-26. UPI transaction reference no.: 131184658489.";
        const result = deterministicParse(text);

        expect(result.merchant).toBe("Juice Pops");
        expect(result.amount).toBe(35);
    });

    it("preserves backward compatibility with domain-style merchant names", () => {
        const text =
            "HDFC BANK --> Dear Customer, Greetings from HDFC Bank! Rs.3144.95 is debited from your account ending 5662 towards VPA pinelabs.11093315@pineaxis (IRCTC Ticketing) on 13-10-26. UPI transaction reference no.: 131195095920.";
        const result = deterministicParse(text);

        expect(result.merchant).toBe("Irctc Ticketing");
        expect(result.amount).toBe(3144.95);
    });

    it("extracts meaningful name from VPA handle when parentheses only contain the VPA handle", () => {
        const text =
            "HDFC BANK --> Dear Customer, Greetings from HDFC Bank! Rs.52.00 is debited from your account ending 5662 towards VPA asmete1981@okaxis (asmete1981@okaxis) on 01-05-24.";
        const result = deterministicParse(text);

        expect(result.merchant).toBe("Asmete");
        expect(result.amount).toBe(52);
    });

    it("extracts merchant from structured details with 'Paid To:' label", () => {
        const text =
            "Payment Details Amount: Rs. 12589.00 From Account: **********5662 Paid To: ICICI BANK CREDIT CA Important Note";
        const result = deterministicParse(text);

        expect(result.merchant).toBe("ICICI Bank Credit Ca");
        expect(result.amount).toBe(12589);
    });

    it("correctly identifies transaction types", () => {
        expect(deterministicParse("Salary credited: Rs. 75,000 to your account").transactionType).toBe("SALARY");
        expect(deterministicParse("Refund of Rs. 499 credited to your account").transactionType).toBe("REFUND");
        expect(deterministicParse("Account credited with Rs. 1,200").transactionType).toBe("CREDIT");
        expect(deterministicParse("Debited Rs. 450 for payment at Starbucks").transactionType).toBe("DEBIT");
    });
});

describe("transactionParserUtils", () => {
    it("cleans candidate names properly", () => {
        expect(transactionParserUtils.cleanMerchantCandidate("RUDRA PRATAP SINGH")).toBe("Rudra Pratap Singh");
        expect(transactionParserUtils.cleanMerchantCandidate("SWISH")).toBe("Swish");
        expect(transactionParserUtils.cleanMerchantCandidate("")).toBeUndefined();
    });

    it("keys strings consistently for dictionary lookups", () => {
        expect(transactionParserUtils.keyFor("Swiggy India Pvt Ltd")).toBe("swiggy india pvt ltd");
        expect(transactionParserUtils.keyFor("  Starbucks  Coffee ")).toBe("starbucks coffee");
    });
});
