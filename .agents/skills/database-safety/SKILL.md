# Database Safety Skill

## Purpose

Provide strict protocols for modifying, querying, and migrating the PostgreSQL database via Prisma ORM (`prisma/schema.prisma`) in the **Personal Financial Advisor** system.

---

## When to Use

Use this skill whenever:
* Adding or updating Prisma schema models or fields.
* Creating database migration files or running migration scripts.
* Writing raw SQL queries or complex Prisma data access code.
* Modifying data models for Transactions, Goals, FinancialProfile, Investments, Assets, or Liabilities.

---

## Database Architecture & Client Abstraction

* **Database Engine**: PostgreSQL.
* **ORM**: Prisma ORM v5 (`@prisma/client`).
* **Schema Location**: `prisma/schema.prisma`.
* **Prisma Client Import**: Always import singleton from `@/src/lib/prisma` or `@/lib/prisma`.
  ```typescript
  import { prisma } from "../lib/prisma";
  ```

---

## Pre-Modification Database Safety Checklist

Before making ANY database-related code or schema modification:

- [ ] **Inspect Schema**: Read `prisma/schema.prisma` completely to understand existing models, relations, default values, and indexes.
- [ ] **Identify Consumers**: Search the codebase for all references to the model or field being modified.
- [ ] **Check Nullability**: Ensure new fields are either optional (`field String?`) or have explicit default values (`@default(...)`).
- [ ] **Preserve Existing Data**: Ensure schema edits will not result in data loss for existing production records.
- [ ] **Validate Unique Constraints**: Check unique indexes (e.g. `sourceMessageId`, `merchantKey`, `email`) to prevent insertion failures.

---

## Migration Safety & Workflow

### 1. Non-Destructive Schema Extensions (Safe)
Adding new models, adding optional fields, or adding default values:
1. Update `prisma/schema.prisma`.
2. Generate Prisma client:
   ```bash
   npm run prisma:generate
   ```
3. Test locally with `npm run prisma:push` or create dev migration:
   ```bash
   npx prisma migrate dev --name <descriptive_name>
   ```

### 2. Destructive Operations (HIGH RISK — PROHIBITED WITHOUT CONFIRMATION)
The following actions are classified as **HIGH RISK** and MUST NOT be performed without explicit user approval:
- Dropping models/tables (`drop table`).
- Dropping columns/fields (`drop column`).
- Changing field types destructively (e.g. `String` to `Float` without data transformation).
- Renaming fields without a data migration script.

---

## Critical Rules for Database Operations

1. **Use Parameterized Prisma Queries**: Always use standard Prisma model queries (`findUnique`, `findMany`, `create`, `update`, `aggregate`). Never string-concat user input into raw SQL queries (`$queryRawUnsafe`).
2. **Use Database Transactions for Atomic Multi-Table Writes**: When creating or updating linked records (e.g. transaction ingestion + profile balance update + ingestion key), wrap operations in `prisma.$transaction([...])`.
3. **Avoid N+1 Query Loops**: Batch queries using `in` filters or use Prisma `include` / `select` relations rather than querying inside `.map()` or `for` loops.
4. **Never Alter Stored Financial Meaning**: Do not re-purpose existing fields (e.g., storing USD amounts in an INR field) without explicit data migration.
5. **Handle Missing Records Gracefully**: Handle `null` returns from `findFirst` or `findUnique` safely without assuming records exist.

---

## Example: Safe Prisma Transaction Pattern

```typescript
// Good: Atomic transaction guarantees consistency across ingestion and profile balance
await prisma.$transaction(async (tx) => {
  const transaction = await tx.transaction.create({
    data: transactionData,
  });

  await tx.transactionIngestionKey.create({
    data: { key: fingerprintKey, transactionId: transaction.id },
  });

  await tx.financialProfile.update({
    where: { id: profileId },
    data: { balance: { increment: balanceImpact } },
  });
});
```

---

## Completion Criteria

Database-related work is complete ONLY when:
1. Schema changes are non-destructive and backward-compatible.
2. `npm run prisma:generate` succeeds cleanly.
3. No raw unparameterized SQL queries are introduced.
4. `npx tsc --noEmit` and `npm run lint` pass with **0 errors and 0 warnings**.
5. All Vitest unit tests pass (`npm run test`).
