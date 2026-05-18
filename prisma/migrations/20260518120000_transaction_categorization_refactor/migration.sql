-- Add transaction metadata fields so categories are reserved for spending intent.
ALTER TABLE "Transaction" ADD COLUMN "paymentMethod" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "bankName" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "transactionType" TEXT NOT NULL DEFAULT 'OTHER';
ALTER TABLE "Transaction" ADD COLUMN "rawText" TEXT NOT NULL DEFAULT '';

UPDATE "Transaction"
SET "transactionType" = COALESCE(NULLIF("type", ''), 'OTHER'),
    "rawText" = COALESCE(NULLIF("raw", ''), '');

-- Persistent merchant learning table used by manual corrections and future ingestion.
CREATE TABLE "MerchantCategoryMap" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "merchantKey" TEXT NOT NULL,
    "merchantName" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "confidence" REAL NOT NULL DEFAULT 0.95,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MerchantCategoryMap_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "MerchantCategoryMap_merchantKey_key" ON "MerchantCategoryMap"("merchantKey");

-- Legacy cleanup: infrastructure categories are not spending categories.
INSERT OR IGNORE INTO "Category" ("id", "name", "createdAt", "updatedAt")
VALUES ('category_miscellaneous_legacy_cleanup', 'Miscellaneous', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

UPDATE "Transaction"
SET "categoryId" = (SELECT "id" FROM "Category" WHERE "name" = 'Miscellaneous' LIMIT 1)
WHERE "categoryId" IN (
    SELECT "id" FROM "Category" WHERE lower("name") IN ('bank', 'transfer', 'upi', 'vpa')
);

DELETE FROM "Category"
WHERE lower("name") IN ('bank', 'transfer', 'upi', 'vpa')
  AND "id" NOT IN (SELECT DISTINCT "categoryId" FROM "Transaction" WHERE "categoryId" IS NOT NULL);
