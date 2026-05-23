const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { Prisma, PrismaClient } = require("@prisma/client");

const projectRoot = path.resolve(__dirname, "..");
const defaultSqlitePath = path.join(projectRoot, "prisma", "dev.db");

function quoteIdentifier(name) {
    return `"${String(name).replace(/"/g, '""')}"`;
}

function getModels() {
    return [...Prisma.dmmf.datamodel.models];
}

function getDelegateName(modelName) {
    return modelName.charAt(0).toLowerCase() + modelName.slice(1);
}

function getModelDependencies(model) {
    return model.fields
        .filter((field) => field.kind === "object" && field.relationFromFields.length > 0)
        .map((field) => field.type);
}

function topologicalSortModels(models) {
    const nodes = new Map(models.map((model) => [model.name, { model, dependencies: new Set(getModelDependencies(model)) }]));
    const ordered = [];

    while (nodes.size > 0) {
        const nextEntry = [...nodes.entries()].find(([, entry]) => [...entry.dependencies].every((dependency) => !nodes.has(dependency)));

        if (!nextEntry) {
            throw new Error(`Unable to determine migration order for models: ${[...nodes.keys()].join(", ")}`);
        }

        const [name, entry] = nextEntry;
        ordered.push(entry.model);
        nodes.delete(name);
    }

    return ordered;
}

function runSqliteJson(databasePath, sql) {
    const result = spawnSync("sqlite3", ["-json", databasePath, sql], {
        encoding: "utf8",
        maxBuffer: 100 * 1024 * 1024,
    });

    if (result.status !== 0) {
        const message = String(result.stderr || result.error?.message || "");
        if (message.includes("no such table")) {
            return [];
        }
        throw result.error || new Error(message || "sqlite3 query failed");
    }

    const output = String(result.stdout || "").trim();

    if (!output) return [];
    return JSON.parse(output);
}

function readSqliteRows(databasePath, modelName) {
    return runSqliteJson(databasePath, `SELECT * FROM ${quoteIdentifier(modelName)} ORDER BY ${quoteIdentifier("id")}`);
}

function readSqliteCountInfo(databasePath, modelName) {
    const rows = runSqliteJson(
        databasePath,
        `SELECT COUNT(*) AS count, COUNT(DISTINCT ${quoteIdentifier("id")}) AS distinctIds FROM ${quoteIdentifier(modelName)}`,
    );

    const row = rows[0] || { count: 0, distinctIds: 0 };
    return {
        count: Number(row.count || 0),
        distinctIds: Number(row.distinctIds || 0),
    };
}

function readSqliteIds(databasePath, modelName) {
    const rows = runSqliteJson(databasePath, `SELECT ${quoteIdentifier("id")} AS id FROM ${quoteIdentifier(modelName)} ORDER BY ${quoteIdentifier("id")}`);
    return rows.map((row) => String(row.id));
}

function normalizeScalarValue(field, value) {
    if (value === null || value === undefined) return value;

    switch (field.type) {
        case "DateTime":
            return value instanceof Date ? value : new Date(value);
        case "Boolean":
            return value === true || value === 1 || value === "1" || value === "true";
        case "Int":
        case "Float":
            return Number(value);
        default:
            return value;
    }
}

function rowToCreateData(model, row) {
    const data = {};

    for (const field of model.fields) {
        if (field.kind === "object") continue;
        if (!(field.name in row)) continue;
        data[field.name] = normalizeScalarValue(field, row[field.name]);
    }

    return data;
}

function normalizeRowForComparison(model, row) {
    return rowToCreateData(model, row);
}

function chunkArray(items, chunkSize) {
    const chunks = [];

    for (let index = 0; index < items.length; index += chunkSize) {
        chunks.push(items.slice(index, index + chunkSize));
    }

    return chunks;
}

function getUniqueConstraints(model) {
    const uniqueConstraints = [];

    for (const field of model.fields) {
        if (field.isId || field.isUnique) {
            uniqueConstraints.push([field.name]);
        }
    }

    for (const uniqueFieldSet of model.uniqueFields || []) {
        if (uniqueFieldSet.length > 0) {
            uniqueConstraints.push([...uniqueFieldSet]);
        }
    }

    return uniqueConstraints;
}

function findDuplicateValues(rows, fieldNames) {
    const seen = new Map();
    const duplicates = [];

    for (const row of rows) {
        const values = fieldNames.map((fieldName) => row[fieldName]);
        if (values.some((value) => value === null || value === undefined)) {
            continue;
        }

        const key = values.map((value) => String(value)).join("::");
        if (seen.has(key)) {
            duplicates.push({ key, first: seen.get(key), duplicate: row });
            continue;
        }

        seen.set(key, row);
    }

    return duplicates;
}

function getTargetDelegate(prisma, modelName) {
    const delegate = prisma[getDelegateName(modelName)];
    if (!delegate) {
        throw new Error(`Prisma delegate not found for model ${modelName}`);
    }
    return delegate;
}

async function createTargetPrisma() {
    const prisma = new PrismaClient();
    await prisma.$connect();
    return prisma;
}

function ensureSqliteSourceExists(databasePath) {
    if (!fs.existsSync(databasePath)) {
        throw new Error(`SQLite source database not found at ${databasePath}`);
    }
}

module.exports = {
    Prisma,
    createTargetPrisma,
    chunkArray,
    defaultSqlitePath,
    ensureSqliteSourceExists,
    findDuplicateValues,
    getModels,
    getTargetDelegate,
    getUniqueConstraints,
    readSqliteCountInfo,
    readSqliteIds,
    readSqliteRows,
    rowToCreateData,
    normalizeRowForComparison,
    topologicalSortModels,
};