/**
 * paperTrading/index.ts — Virtual Portfolio & Paper Trading Engine.
 *
 * Provides a fully isolated sandbox to simulate execution of North Stock Intelligence
 * recommendations using real market data and realistic transaction costs,
 * completely segregated from real user money and bank accounts.
 *
 * Responsibilities:
 *   - Manage virtual paper portfolio (initial default: ₹100,000)
 *   - Execute paper Buy and Sell orders
 *   - Deduct realistic Indian equity delivery costs & slippage
 *   - Mark-to-market daily open positions against latest market bars
 *   - Detect automated stop-loss breaches, profit targets, or holding day expirations
 *   - Maintain peak equity and compute realistic paper drawdown
 */

import { prisma } from "../../lib/prisma";
import { TRADING_COSTS, RISK_CONFIG } from "../../config/stockEngineDefaults";
import type { StrategyName } from "../../config/stockEngineDefaults";
import type {
  PaperPortfolio,
  PaperTrade,
  PaperTradeStatus,
} from "../../types/stockIntelligence";

const DEFAULT_INITIAL_VIRTUAL_CASH = 100000;

/**
 * Get or create the active virtual paper trading portfolio.
 */
export async function getOrCreatePaperPortfolio(): Promise<PaperPortfolio> {
  let portfolioRecord = await prisma.stockPaperPortfolio.findFirst({
    where: { isActive: true },
    include: {
      trades: {
        orderBy: { entryDate: "desc" },
      },
    },
  });

  if (!portfolioRecord) {
    portfolioRecord = await prisma.stockPaperPortfolio.create({
      data: {
        virtualCash: DEFAULT_INITIAL_VIRTUAL_CASH,
        initialCash: DEFAULT_INITIAL_VIRTUAL_CASH,
        equityPeak: DEFAULT_INITIAL_VIRTUAL_CASH,
        isActive: true,
      },
      include: {
        trades: true,
      },
    });
  }

  return formatPaperPortfolio(portfolioRecord);
}

/**
 * Helper to format Prisma model to domain PaperPortfolio.
 */
function formatPaperPortfolio(record: {
  id: string;
  virtualCash: number;
  initialCash: number;
  equityPeak: number;
  startDate: Date;
  trades: Array<{
    id: string;
    symbol: string;
    exchange: string;
    strategy: string;
    side: string;
    quantity: number;
    entryPrice: number;
    entryDate: Date;
    exitPrice: number | null;
    exitDate: Date | null;
    stopLoss: number;
    targetPrice: number | null;
    status: string;
    pnl: number;
    pnlPct: number;
    costs: number;
    holdingDays: number;
    exitReason: string | null;
  }>;
}): PaperPortfolio {
  const openTrades: PaperTrade[] = [];
  const closedTrades: PaperTrade[] = [];

  let openPositionsValue = 0;
  let totalCosts = 0;
  let totalPnl = 0;

  for (const t of record.trades) {
    const formatted: PaperTrade = {
      id: t.id,
      symbol: t.symbol,
      exchange: t.exchange,
      strategy: t.strategy as StrategyName,
      side: t.side as "BUY" | "SELL",
      quantity: t.quantity,
      entryPrice: t.entryPrice,
      entryDate: t.entryDate.toISOString().slice(0, 10),
      exitPrice: t.exitPrice,
      exitDate: t.exitDate ? t.exitDate.toISOString().slice(0, 10) : null,
      stopLoss: t.stopLoss,
      targetPrice: t.targetPrice,
      status: t.status as PaperTradeStatus,
      pnl: t.pnl,
      pnlPct: t.pnlPct,
      costs: t.costs,
      holdingDays: t.holdingDays,
      exitReason: t.exitReason,
    };

    totalCosts += t.costs;

    if (t.status === "OPEN") {
      openTrades.push(formatted);
      openPositionsValue += t.quantity * t.entryPrice + t.pnl;
    } else {
      closedTrades.push(formatted);
      totalPnl += t.pnl;
    }
  }

  const totalEquity = record.virtualCash + openPositionsValue;
  const equityPeak = Math.max(record.equityPeak, totalEquity);
  const drawdownPct = equityPeak > 0
    ? Number((((equityPeak - totalEquity) / equityPeak) * 100).toFixed(2))
    : 0;

  const winCount = closedTrades.filter((t) => t.pnl > 0).length;
  const winRate = closedTrades.length > 0
    ? Number(((winCount / closedTrades.length) * 100).toFixed(1))
    : 0;

  return {
    virtualCash: Number(record.virtualCash.toFixed(2)),
    initialCash: Number(record.initialCash.toFixed(2)),
    positions: openTrades,
    closedTrades,
    totalEquity: Number(totalEquity.toFixed(2)),
    equityPeak: Number(equityPeak.toFixed(2)),
    drawdownPct,
    totalPnl: Number(totalPnl.toFixed(2)),
    totalCosts: Number(totalCosts.toFixed(2)),
    winRate,
    tradeCount: record.trades.length,
    startDate: record.startDate.toISOString().slice(0, 10),
  };
}

/**
 * Execute a simulated Buy order in paper trading.
 */
export async function executePaperBuy(params: {
  symbol: string;
  exchange?: string;
  strategy: StrategyName;
  quantity: number;
  entryPrice: number;
  stopLoss: number;
  targetPrice?: number | null;
  slippagePct?: number;
}): Promise<PaperTrade> {
  const exchange = params.exchange || "NSE";
  const slippage = params.slippagePct ?? RISK_CONFIG.slippageAssumptionPct;
  const effectiveEntryPrice = Number((params.entryPrice * (1 + slippage / 100)).toFixed(2));
  const tradeValue = effectiveEntryPrice * params.quantity;

  const portfolio = await prisma.stockPaperPortfolio.findFirst({
    where: { isActive: true },
  });

  if (!portfolio) {
    throw new Error("Active paper trading portfolio not found");
  }

  const buyCostEstimate = TRADING_COSTS.estimateBuyCost(tradeValue);
  const totalDeduction = tradeValue + buyCostEstimate;

  if (portfolio.virtualCash < totalDeduction) {
    throw new Error(
      `Insufficient paper cash. Required: ₹${totalDeduction.toFixed(2)}, Available: ₹${portfolio.virtualCash.toFixed(2)}`,
    );
  }

  // Update cash and create trade in a transaction
  const [createdTrade] = await prisma.$transaction([
    prisma.stockPaperTrade.create({
      data: {
        portfolioId: portfolio.id,
        symbol: params.symbol,
        exchange,
        strategy: params.strategy,
        side: "BUY",
        quantity: params.quantity,
        entryPrice: effectiveEntryPrice,
        entryDate: new Date(),
        stopLoss: params.stopLoss,
        targetPrice: params.targetPrice ?? null,
        status: "OPEN",
        costs: buyCostEstimate,
      },
    }),
    prisma.stockPaperPortfolio.update({
      where: { id: portfolio.id },
      data: {
        virtualCash: portfolio.virtualCash - totalDeduction,
      },
    }),
  ]);

  return {
    id: createdTrade.id,
    symbol: createdTrade.symbol,
    exchange: createdTrade.exchange,
    strategy: createdTrade.strategy as StrategyName,
    side: "BUY",
    quantity: createdTrade.quantity,
    entryPrice: createdTrade.entryPrice,
    entryDate: createdTrade.entryDate.toISOString().slice(0, 10),
    exitPrice: null,
    exitDate: null,
    stopLoss: createdTrade.stopLoss,
    targetPrice: createdTrade.targetPrice,
    status: "OPEN",
    pnl: 0,
    pnlPct: 0,
    costs: createdTrade.costs,
    holdingDays: 0,
    exitReason: null,
  };
}

/**
 * Close/Sell an open paper trade position.
 */
export async function executePaperSell(
  tradeId: string,
  exitPrice: number,
  exitReason: string = "MANUAL_EXIT",
): Promise<PaperTrade> {
  const trade = await prisma.stockPaperTrade.findUnique({
    where: { id: tradeId },
    include: { portfolio: true },
  });

  if (!trade) {
    throw new Error(`Paper trade with ID ${tradeId} not found`);
  }

  if (trade.status !== "OPEN") {
    throw new Error(`Trade ${tradeId} is already closed (status: ${trade.status})`);
  }

  const grossProceeds = exitPrice * trade.quantity;
  const sellCosts = TRADING_COSTS.estimateSellCost(grossProceeds);
  const netProceeds = grossProceeds - sellCosts;

  const totalCosts = trade.costs + sellCosts;
  const netPnl = netProceeds - (trade.entryPrice * trade.quantity);
  const netPnlPct = Number(((netPnl / (trade.entryPrice * trade.quantity)) * 100).toFixed(2));

  const entryDate = new Date(trade.entryDate);
  const today = new Date();
  const diffTime = Math.abs(today.getTime() - entryDate.getTime());
  const holdingDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

  const status: PaperTradeStatus = exitReason.includes("STOP")
    ? "STOPPED"
    : "CLOSED";

  const [updatedTrade] = await prisma.$transaction([
    prisma.stockPaperTrade.update({
      where: { id: tradeId },
      data: {
        exitPrice,
        exitDate: today,
        status,
        pnl: netPnl,
        pnlPct: netPnlPct,
        costs: totalCosts,
        holdingDays,
        exitReason,
      },
    }),
    prisma.stockPaperPortfolio.update({
      where: { id: trade.portfolioId },
      data: {
        virtualCash: trade.portfolio.virtualCash + netProceeds,
      },
    }),
  ]);

  return {
    id: updatedTrade.id,
    symbol: updatedTrade.symbol,
    exchange: updatedTrade.exchange,
    strategy: updatedTrade.strategy as StrategyName,
    side: "SELL",
    quantity: updatedTrade.quantity,
    entryPrice: updatedTrade.entryPrice,
    entryDate: updatedTrade.entryDate.toISOString().slice(0, 10),
    exitPrice: updatedTrade.exitPrice,
    exitDate: updatedTrade.exitDate ? updatedTrade.exitDate.toISOString().slice(0, 10) : null,
    stopLoss: updatedTrade.stopLoss,
    targetPrice: updatedTrade.targetPrice,
    status,
    pnl: Number(netPnl.toFixed(2)),
    pnlPct: netPnlPct,
    costs: Number(totalCosts.toFixed(2)),
    holdingDays,
    exitReason,
  };
}

/**
 * Synchronize all open paper trades with latest market bars.
 * Marks to market, triggers automated stop loss or target hits, and calculates updated equity peak.
 */
export async function syncPaperPortfolioWithMarketBars(): Promise<PaperPortfolio> {
  const portfolio = await prisma.stockPaperPortfolio.findFirst({
    where: { isActive: true },
    include: {
      trades: {
        where: { status: "OPEN" },
      },
    },
  });

  if (!portfolio) {
    return getOrCreatePaperPortfolio();
  }

  const today = new Date();

  for (const trade of portfolio.trades) {
    // Find latest market bar for the symbol
    const latestBar = await prisma.stockMarketBar.findFirst({
      where: { symbol: trade.symbol },
      orderBy: { date: "desc" },
    });

    if (!latestBar) continue;

    const currentPrice = latestBar.close;
    const lowPrice = latestBar.low;
    const highPrice = latestBar.high;

    const entryDate = new Date(trade.entryDate);
    const holdingDays = Math.max(1, Math.ceil((today.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24)));

    // Check stop loss hit
    if (lowPrice <= trade.stopLoss) {
      await executePaperSell(trade.id, trade.stopLoss, `Stop-loss hit at ₹${trade.stopLoss.toFixed(2)}`);
      continue;
    }

    // Check target price hit
    if (trade.targetPrice !== null && highPrice >= trade.targetPrice) {
      await executePaperSell(trade.id, trade.targetPrice, `Target reached at ₹${trade.targetPrice.toFixed(2)}`);
      continue;
    }

    // Otherwise mark to market
    const unrealizedGross = (currentPrice - trade.entryPrice) * trade.quantity;
    const estSellCost = TRADING_COSTS.estimateSellCost(currentPrice * trade.quantity);
    const unrealizedNet = unrealizedGross - estSellCost;
    const unrealizedPct = Number(((unrealizedNet / (trade.entryPrice * trade.quantity)) * 100).toFixed(2));

    await prisma.stockPaperTrade.update({
      where: { id: trade.id },
      data: {
        pnl: unrealizedNet,
        pnlPct: unrealizedPct,
        holdingDays,
      },
    });
  }

  return getOrCreatePaperPortfolio();
}

/**
 * Reset paper portfolio to a clean initial state.
 */
export async function resetPaperPortfolio(initialCash: number = DEFAULT_INITIAL_VIRTUAL_CASH): Promise<PaperPortfolio> {
  const existing = await prisma.stockPaperPortfolio.findFirst({
    where: { isActive: true },
  });

  if (existing) {
    await prisma.stockPaperTrade.deleteMany({
      where: { portfolioId: existing.id },
    });
    await prisma.stockPaperPortfolio.update({
      where: { id: existing.id },
      data: {
        virtualCash: initialCash,
        initialCash,
        equityPeak: initialCash,
        startDate: new Date(),
      },
    });
  }

  return getOrCreatePaperPortfolio();
}
