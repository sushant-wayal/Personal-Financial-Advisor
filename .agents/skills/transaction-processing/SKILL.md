# Transaction Processing Skill

## Purpose

Document the **end-to-end transaction processing pipeline** in the **Personal Financial Advisor** system, covering parsing, deduplication, categorization, balance updating, asset/liability side-effects, and database persistence.

---

## The Transaction Processing Pipeline

Transactions enter the system via Bank SMS webhooks (`app/api/transactions/ingest/route.ts`), Gmail bank email processors (`gmail-webhook.service.ts`), or manual user entry (`app/api/transactions/route.ts`). They pass through an 8-stage pipeline:

```text
1. Raw Webhook / Email Payload Received (`app/api/transactions/ingest/route.ts` / `gmail-webhook.service.ts`)
        ↓
2. Deterministic Parsing (`transactionParser.ts`)
   (Extracts amount, merchant, transactionType, bankName, paymentMethod, account, timestamp)
        ↓
3. Fingerprint & Deduplication Lookup (`buildTransactionIngestionKeys` & `TransactionIngestionKey`)
   (Generates sha256 fingerprint hash; skips processing if message ID or tx fingerprint exists)
        ↓
4. Merchant Mapping & Auto-Categorization (`categorizer.ts`)
   (Matches merchant against `MerchantCategoryMap` dictionary & `Category` table)
        ↓
5. Balance Impact & Asset/Liability Side Effects (`balance.ts` & `transactionIngestion.ts`)
   (Calculates CREDIT vs DEBIT impact; updates PPF, EPF, Mutual Funds, Stocks, FDs, RDs, Liabilities if applicable)
        ↓
6. Database Persistence (`prisma.transaction` & `prisma.transactionIngestionKey`)
   (Persists record inside Prisma database transaction via `ingestSingleTransaction()`)
        ↓
7. Profile Balance Update (`updateProfileBalanceBy` in `balance.ts`)
   (Adjusts `FinancialProfile.balance`)
        ↓
8. Goal & Advisor Triggers (`adviseGoals` & `getGoalOverview`)
   (Triggers automated goal progress checks and insight generation)
```

---

## Key Pipeline Components & Rules

### 1. Deterministic Parser (`transactionParser.ts`)
- Regex-based extraction of bank notification texts (HDFC, ICICI, SBI, Axis, Paytm, UPI, etc.).
- Normalizes raw text into structured parameters:
  - `amount`: Positive floating-point number.
  - `type`: Direction (`DEBIT` | `CREDIT` | `TRANSFER`).
  - `transactionType`: Category classification (`UPI`, `CARD`, `ATM`, `SALARY`, `REFUND`, `OTHER`, `PPF DEPOSIT`, etc.).
  - `merchant`: Cleaned merchant string (e.g., "Swiggy", "Amazon", "Uber").

### 2. Deduplication & Idempotency (`transactionIngestion.ts`)
- Prevents duplicate transactions from repeated SMS webhooks or multi-sync email polling.
- Generates two lookup keys per transaction via `buildTransactionIngestionKeys()`:
  1. `message:<source>:<sourceMessageId>` (if message ID present)
  2. Fingerprint hash: `sha256("tx:v1:<source>:<merchant>:<amount>:<timestamp>:<type>")`
- Searches `TransactionIngestionKey` table. If key exists with status `RECORDED`, ingestion is skipped idempotently without throwing an error.

### 3. Categorization Engine (`categorizer.ts`)
- First searches exact/fuzzy matches in `MerchantCategoryMap`.
- Falls back to keyword rules (e.g., "zomato" → Food & Dining, "uber" → Transportation, "salary" → Salary).
- Dynamically creates new categories in `Category` table if non-existent via `findOrCreateCategory()`.

### 4. Balance Impact & Asset/Liability Side Effects (`balance.ts` & `transactionIngestion.ts`)
- **CREDIT_TYPES**: `CREDIT`, `CREDITED`, `SALARY`, `REFUND`, `DEPOSIT`. Increases `FinancialProfile.balance`.
- **DEBIT_TYPES**: `DEBIT`, `DEBITED`, `WITHDRAWAL`, `PAYMENT`, `PURCHASE`. Decreases `FinancialProfile.balance`.
- **Self-Transfers**: Category named "transfer" or "bank", or type `TRANSFER`. Balance impact = 0. MUST NOT alter profile balance or surplus calculations.
- **Asset/Liability Side Effects**: `applyTransactionSideEffects()` automatically adjusts linked `PPFAccount`, `EPFAccount`, `MutualFund`, `Stock`, `FDAccount`, `RDAccount`, `LoanLiability`, and `CreditCardLiability` models based on transaction type.

---

## Transaction Ingestion Safety Checklist

Before modifying transaction ingestion or parsing logic:

- [ ] Does parsing handle missing fields (e.g. missing merchant or account number) gracefully without throwing?
- [ ] Is `amount` strictly parsed as a positive number?
- [ ] Are idempotency keys generated correctly via `buildTransactionIngestionKeys()`?
- [ ] Are self-transfers (`TRANSFER`, "bank", "transfer") correctly excluded from income/expense metrics?
- [ ] Is database write executed inside a Prisma transaction to ensure atomicity?
- [ ] Does `npm run test` pass all parser and ingestion test suites?

---

## Completion Criteria

Transaction processing changes are complete ONLY when:
1. Ingestion idempotency is maintained (zero duplicate transactions created on re-ingest).
2. Self-transfers do not corrupt balance or burn rate calculations.
3. Unit tests in `src/services/balance.test.ts` pass cleanly.
4. `npx tsc --noEmit` and `npm run lint` pass with **0 errors and 0 warnings**.
