#!/usr/bin/env node

const {
    createTargetPrisma,
    defaultSqlitePath,
    ensureSqliteSourceExists,
    getModels,
    getTargetDelegate,
    readSqliteCountInfo,
    readSqliteIds,
    topologicalSortModels,
} = require("./migration-utils");

const sourceDatabasePath = process.env.SQLITE_SOURCE_PATH || defaultSqlitePath;

function quoteIdentifier(name) {
    return `"${String(name).replace(/"/g, '""')}"`;
}

async function countOrphans(prisma, childModel, relationField) {
    const childTable = quoteIdentifier(childModel.name);
    const parentTable = quoteIdentifier(relationField.type);
    const foreignKey = quoteIdentifier(relationField.relationFromFields[0]);
    const query = `
        SELECT COUNT(*) AS missing
        FROM ${childTable} c
        LEFT JOIN ${parentTable} p ON c.${foreignKey} = p.${quoteIdentifier("id")}
        WHERE c.${foreignKey} IS NOT NULL AND p.${quoteIdentifier("id")} IS NULL
    `;

    const rows = await prisma.$queryRawUnsafe(query);
    return Number(rows[0]?.missing || 0);
}

async function main() {
    ensureSqliteSourceExists(sourceDatabasePath);
    const prisma = await createTargetPrisma();

    try {
        const models = topologicalSortModels(getModels());
        let allGood = true;

        console.log(`Verifying against source SQLite: ${sourceDatabasePath}`);

        for (const model of models) {
            const delegate = getTargetDelegate(prisma, model.name);
            const sourceCounts = readSqliteCountInfo(sourceDatabasePath, model.name);
            const sourceIds = readSqliteIds(sourceDatabasePath, model.name);
            const targetCount = await delegate.count();
            const targetIds = (await delegate.findMany({ select: { id: true }, orderBy: { id: "asc" } })).map((row) => String(row.id));
            const uniqueTargetIds = new Set(targetIds);
            const idsMatch = sourceIds.length === targetIds.length && sourceIds.every((id, index) => id === targetIds[index]);
            const rowCountMatch = sourceCounts.count === targetCount;
            const uniqueIdCountMatch = sourceCounts.distinctIds === uniqueTargetIds.size;

            if (!rowCountMatch || !uniqueIdCountMatch || !idsMatch) {
                allGood = false;
            }

            console.log(
                `${model.name}: source rows=${sourceCounts.count}, target rows=${targetCount}, source unique ids=${sourceCounts.distinctIds}, target unique ids=${uniqueTargetIds.size}, ids match=${idsMatch ? "yes" : "no"}`,
            );
        }

        for (const model of models) {
            for (const relationField of model.fields.filter((field) => field.kind === "object" && field.relationFromFields.length > 0)) {
                const orphanCount = await countOrphans(prisma, model, relationField);
                if (orphanCount > 0) {
                    allGood = false;
                }
                console.log(`${model.name}.${relationField.name}: orphan rows=${orphanCount}`);
            }
        }

        if (!allGood) {
            throw new Error("Migration verification failed. See the log above for mismatches.");
        }

        console.log("Migration verification succeeded.");
    } finally {
        await prisma.$disconnect();
    }
}

main().catch((error) => {
    console.error("Migration verification failed:");
    console.error(error instanceof Error ? error.stack || error.message : error);
    process.exit(1);
});