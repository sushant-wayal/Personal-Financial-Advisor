-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Goal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "targetAmount" REAL NOT NULL,
    "currentAmount" REAL NOT NULL DEFAULT 0,
    "monthlyTarget" REAL,
    "goalType" TEXT NOT NULL DEFAULT 'PURCHASE',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "priority" INTEGER NOT NULL DEFAULT 3,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "targetDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "notes" TEXT,
    "icon" TEXT,
    "color" TEXT
);
INSERT INTO "new_Goal" ("createdAt", "currentAmount", "id", "monthlyTarget", "notes", "priority", "targetAmount", "targetDate", "title", "updatedAt") SELECT "createdAt", "currentAmount", "id", "monthlyTarget", "notes", "priority", "targetAmount", "targetDate", "title", "updatedAt" FROM "Goal";
DROP TABLE "Goal";
ALTER TABLE "new_Goal" RENAME TO "Goal";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
