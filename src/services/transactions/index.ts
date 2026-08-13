/**
 * Transaction domain — barrel re-export.
 *
 * All transaction-related services live in the parent `src/services/` directory.
 * This barrel makes them importable as a domain group:
 *   import { ingestTransaction } from "@/src/services/transactions"
 *
 * For AI agents: this is the domain for transaction parsing, ingestion,
 * categorization, balance tracking, and subscription detection.
 */
export * from "../transactionParser";
export * from "../transactionIngestion";
export * from "../transactions";
export * from "../categorizer";
export * from "../subscriptionDetector";
export * from "../balance";
