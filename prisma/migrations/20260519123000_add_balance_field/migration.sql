-- Add stored balance to FinancialProfile and remove currentCash.
ALTER TABLE "FinancialProfile" ADD COLUMN "balance" DOUBLE PRECISION NOT NULL DEFAULT 0;

UPDATE "FinancialProfile"
SET "balance" = 15471.50;

ALTER TABLE "FinancialProfile" DROP COLUMN "currentCash";
