/**
 * Gmail integration domain — barrel re-export.
 *
 * All Gmail/email-related services live in the parent `src/services/` directory.
 * This barrel makes them importable as a domain group:
 *   import { refreshAccessToken, fetchEmailBody } from "@/src/services/gmail"
 *
 * For AI agents: this is the domain for Google OAuth token management,
 * Gmail API access, email history polling, webhook processing (for bank
 * emails), and mutual fund / stock price webhook handling.
 */
export * from "../gmail";
export * from "../gmail-history.service";
export * from "../gmail-watch.service";
export * from "../gmail-webhook.service";
export * from "../gmail-sender-filter";
export * from "../mutual-fund-webhook.service";
export * from "../stock-webhook.service";
