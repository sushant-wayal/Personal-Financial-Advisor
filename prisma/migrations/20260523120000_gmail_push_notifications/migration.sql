-- Add Gmail message dedupe and watch state for push-based sync.
ALTER TABLE "Transaction" ADD COLUMN "sourceMessageId" TEXT;

CREATE UNIQUE INDEX "Transaction_sourceMessageId_key" ON "Transaction"("sourceMessageId");

CREATE TABLE "GmailWatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "historyId" TEXT NOT NULL,
    "expiration" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "GmailWatch_email_key" ON "GmailWatch"("email");
