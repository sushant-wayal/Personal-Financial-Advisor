-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "goalId" TEXT;

-- AlterTable
ALTER TABLE "Goal" ADD COLUMN "spentAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Transaction_goalId_idx" ON "Transaction"("goalId");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

