-- Add currentCash to FinancialProfile for balance tracking.
ALTER TABLE "FinancialProfile" ADD COLUMN "currentCash" DOUBLE PRECISION NOT NULL DEFAULT 0;
