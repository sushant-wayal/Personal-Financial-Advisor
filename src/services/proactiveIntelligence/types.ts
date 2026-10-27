/**
 * proactiveIntelligence/types.ts — TypeScript definitions for proactive orchestration and direct notification dispatch.
 */

export interface ActionableIntelligenceReport {
  sessionDate: string;
  hasStockAction: boolean;
  stockBuyCount: number;
  stockSellCount: number;
  stockHighlights: string[];

  hasIpoAction: boolean;
  bestIpoSymbol: string | null;
  bestIpoExpectedGain: number | null;
  bestIpoVerdict: string | null;

  hasMonthlyMfAction: boolean;
  monthlyInvestableTotal: number | null;
  monthlyStockCredit: number | null;

  notificationDispatched: boolean;
  notificationTitle?: string;
  notificationBody?: string;
  notificationRoute?: string;
}

export interface DirectNotificationPayload {
  title: string;
  body: string;
  route: string; // e.g. "/stock-intelligence", "/ipo-intelligence", "/investments"
  metadata?: Record<string, any>;
}
