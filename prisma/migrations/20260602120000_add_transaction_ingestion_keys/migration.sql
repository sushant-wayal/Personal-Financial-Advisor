-- Durable ingestion keys prevent transaction replays even after a ledger row is deleted.
CREATE TABLE "TransactionIngestionKey" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceMessageId" TEXT,
    "transactionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RECORDED',
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransactionIngestionKey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TransactionIngestionKey_key_key" ON "TransactionIngestionKey"("key");

INSERT INTO "TransactionIngestionKey" (
    "id",
    "key",
    "source",
    "sourceMessageId",
    "transactionId",
    "status",
    "createdAt",
    "updatedAt"
)
SELECT
    'tik_msg_' || md5(COALESCE("source", '') || ':' || COALESCE("sourceMessageId", '')),
    'message:' || lower(COALESCE("source", 'unknown')) || ':' || "sourceMessageId",
    COALESCE("source", 'unknown'),
    "sourceMessageId",
    "id",
    'RECORDED',
    COALESCE("createdAt", CURRENT_TIMESTAMP),
    CURRENT_TIMESTAMP
FROM "Transaction"
WHERE "sourceMessageId" IS NOT NULL AND "sourceMessageId" <> ''
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "TransactionIngestionKey" (
    "id",
    "key",
    "source",
    "sourceMessageId",
    "transactionId",
    "status",
    "createdAt",
    "updatedAt"
)
SELECT
    'tik_fp_' || md5(
        lower(COALESCE("source", 'unknown')) || ':' ||
        regexp_replace(lower(trim(COALESCE("merchant", 'unknown'))), '[^a-z0-9]+', ' ', 'g') || ':' ||
        to_char(round(abs(COALESCE("amount", 0))::numeric, 2), 'FM999999999999990.00') || ':' ||
        to_char("timestamp" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') || ':' ||
        upper(COALESCE(NULLIF("transactionType", ''), NULLIF("type", ''), 'OTHER'))
    ),
    'tx:v1:' ||
        lower(COALESCE("source", 'unknown')) || ':' ||
        regexp_replace(lower(trim(COALESCE("merchant", 'unknown'))), '[^a-z0-9]+', ' ', 'g') || ':' ||
        to_char(round(abs(COALESCE("amount", 0))::numeric, 2), 'FM999999999999990.00') || ':' ||
        to_char("timestamp" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') || ':' ||
        upper(COALESCE(NULLIF("transactionType", ''), NULLIF("type", ''), 'OTHER')),
    COALESCE("source", 'unknown'),
    "sourceMessageId",
    "id",
    'RECORDED',
    COALESCE("createdAt", CURRENT_TIMESTAMP),
    CURRENT_TIMESTAMP
FROM "Transaction"
WHERE abs(COALESCE("amount", 0)) > 0
ON CONFLICT ("key") DO NOTHING;
