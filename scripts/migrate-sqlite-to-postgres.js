#!/usr/bin/env node

const {
    chunkArray,
    createTargetPrisma,
    defaultSqlitePath,
    ensureSqliteSourceExists,
    findDuplicateValues,
    getModels,
    getTargetDelegate,
    getUniqueConstraints,
    normalizeRowForComparison,
    readSqliteRows,
    rowToCreateData,
    topologicalSortModels,
} = require("./migration-utils");

const sourceDatabasePath = process.env.SQLITE_SOURCE_PATH || defaultSqlitePath;
const chunkSize = Number(process.env.MIGRATION_BATCH_SIZE || 250);

async function main() {
    ensureSqliteSourceExists(sourceDatabasePath);
    const prisma = await createTargetPrisma();

    try {
        const models = topologicalSortModels(getModels());

        console.log(`Source SQLite: ${sourceDatabasePath}`);
        console.log("Migrating models in dependency order:", models.map((model) => model.name).join(", "));

        for (const model of models) {
            const rows = readSqliteRows(sourceDatabasePath, model.name);
            const uniqueConstraints = getUniqueConstraints(model);
            const delegate = getTargetDelegate(prisma, model.name);
            const targetRows = await delegate.findMany();
            const targetRowsById = new Map(targetRows.map((row) => [String(row.id), normalizeRowForComparison(model, row)]));
            const sourceIds = new Set(rows.map((row) => String(row.id)));

            for (const targetRow of targetRows) {
                if (!sourceIds.has(String(targetRow.id))) {
                    throw new Error(
                        `Target PostgreSQL table ${model.name} already contains id ${String(targetRow.id)} that does not exist in the SQLite source. Resolve the drift before rerunning the migration.`,
                    );
                }
            }

            for (const fieldNames of uniqueConstraints) {
                const duplicates = findDuplicateValues(rows, fieldNames);
                if (duplicates.length > 0) {
                    throw new Error(
                        `Duplicate values detected in source table ${model.name} for unique constraint [${fieldNames.join(", ")}]. Migration cannot preserve every row without violating PostgreSQL constraints.`,
                    );
                }
            }

            const createData = [];

            for (const row of rows) {
                const normalizedSourceRow = normalizeRowForComparison(model, row);
                const existingTargetRow = targetRowsById.get(String(row.id));

                if (existingTargetRow) {
                    const sourceComparison = JSON.stringify(normalizedSourceRow);
                    const targetComparison = JSON.stringify(existingTargetRow);
                    if (sourceComparison !== targetComparison) {
                        await delegate.update({
                            where: { id: String(row.id) },
                            data: (() => {
                                const updateData = { ...normalizedSourceRow };
                                delete updateData.id;
                                return updateData;
                            })(),
                        });
                        console.log(`${model.name}: updated existing row ${String(row.id)} to match SQLite source`);
                    }
                    continue;
                }

                createData.push(rowToCreateData(model, row));
            }

            if (createData.length === 0) {
                console.log(`${model.name}: 0 rows`);
                continue;
            }

            for (const batch of chunkArray(createData, chunkSize)) {
                await delegate.createMany({ data: batch });
            }

            console.log(`${model.name}: migrated ${createData.length} row(s)`);
        }

        console.log("SQLite -> PostgreSQL data copy completed successfully.");
    } finally {
        await prisma.$disconnect();
    }
}

main().catch((error) => {
    console.error("SQLite -> PostgreSQL migration failed:");
    console.error(error instanceof Error ? error.stack || error.message : error);
    process.exit(1);
});