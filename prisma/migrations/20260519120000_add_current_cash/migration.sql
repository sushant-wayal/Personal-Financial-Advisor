-- Add currentCash to FinancialProfile for balance tracking.
ALTER TABLE "FinancialProfile" ADD COLUMN "currentCash" REAL NOT NULL DEFAULT 0;
