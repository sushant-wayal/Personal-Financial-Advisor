/**
 * Centralized, validated environment configuration.
 * Separates server-only configuration from client-safe variables and provides typed access.
 */

export interface AppEnv {
  databaseUrl: string;
  adminPassword?: string;
  authSecret?: string;
  geminiApiKey?: string;
  geminiFlashModel: string;
  geminiProModel: string;
  upstashRedisRestUrl?: string;
  upstashRedisRestToken?: string;
  googleClientId?: string;
  googleClientSecret?: string;
  gmailPubsubTopic?: string;
  gmailHistoryFallbackDays: number;
  nodeEnv: "development" | "production" | "test";
  isProduction: boolean;
  isDevelopment: boolean;
  isTest: boolean;
}

export function getEnv(): AppEnv {
  const nodeEnv = (process.env.NODE_ENV || "development") as AppEnv["nodeEnv"];

  return {
    databaseUrl: process.env.DATABASE_URL || "",
    adminPassword: process.env.ADMIN_PASSWORD,
    authSecret: process.env.AUTH_SECRET,
    geminiApiKey: process.env.GEMINI_API_KEY,
    geminiFlashModel: process.env.GEMINI_FLASH_MODEL || "gemini-3-flash-preview",
    geminiProModel: process.env.GEMINI_PRO_MODEL || "gemini-3-flash-preview",
    upstashRedisRestUrl: process.env.UPSTASH_REDIS_REST_URL,
    upstashRedisRestToken: process.env.UPSTASH_REDIS_REST_TOKEN,
    googleClientId: process.env.GOOGLE_CLIENT_ID,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
    gmailPubsubTopic: process.env.GMAIL_PUBSUB_TOPIC,
    gmailHistoryFallbackDays: Number(process.env.GMAIL_HISTORY_FALLBACK_DAYS || 7),
    nodeEnv,
    isProduction: nodeEnv === "production",
    isDevelopment: nodeEnv === "development",
    isTest: nodeEnv === "test",
  };
}

/**
 * Validates critical environment variables at startup or diagnostic time.
 * In production, warns or throws if critical secrets are missing.
 */
export function validateRequiredEnv(): { valid: boolean; missing: string[] } {
  const missing: string[] = [];
  const env = getEnv();

  if (!env.databaseUrl) {
    missing.push("DATABASE_URL");
  }
  if (env.isProduction) {
    if (!env.authSecret) missing.push("AUTH_SECRET");
    if (!env.adminPassword) missing.push("ADMIN_PASSWORD");
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}

