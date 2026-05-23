-- Add Gmail message dedupe and watch state for push-based sync.
ALTER TABLE "Transaction" ADD COLUMN "sourceMessageId" TEXT;

CREATE UNIQUE INDEX "Transaction_sourceMessageId_key" ON "Transaction"("sourceMessageId");

CREATE TABLE "GmailWatch" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "historyId" TEXT NOT NULL,
    "expiration" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GmailWatch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GmailWatch_email_key" ON "GmailWatch"("email");
