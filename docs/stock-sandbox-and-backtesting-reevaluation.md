# Stock Intelligence: Sandbox & Backtesting Frontend Visibility & Re-evaluation Plan

**Status**: Hidden from Frontend (Web & Mobile) pending comprehensive architectural re-evaluation.  
**Backend Engines**: Fully preserved and operational (`src/services/paperTrading`, `src/services/backtesting`, `/api/stock-intelligence/paper`, `/api/stock-intelligence/backtest`).

---

## 1. Context & Motivation

To ensure user trust and focused daily decision-making, the **Paper Trading Sandbox** and **Historical Strategy Backtester** tabs have been temporarily hidden from both the Web Application and Mobile Application interfaces.

Only two core tabs are currently exposed to users:
1. **Daily Recommendations / Signals**: Actionable swing setups (BUY, HOLD, SELL), whole-share sizing, ATR stop loss, target prices, and live trade tracking.
2. **Capital Safeguards & Risk**: Live deployable budget, binding risk constraints, drawdown throttle gauge, sector concentration, and financial phase insulation.

---

## 2. Issues Identified & Areas for Re-evaluation

Before re-enabling Sandbox and Backtesting on the frontend, the following items must be audited, calibrated, and stress-tested:

### A. Paper Trading Sandbox
1. **Mark-to-Market Realism**:
   - Ensure open simulated positions mark-to-market strictly against closing daily bars (`StockMarketBar`) without artificial slippage jumps.
   - Verify automated stop-loss and target triggers handle intraday highs/lows accurately rather than only closing prices.
2. **Virtual Cash & Trade Lifecycle**:
   - Ensure that simulated exits accurately return cash + P&L after full statutory fees (STT, GST, SEBI, brokerage).
   - Ensure isolation between paper trading records (`StockPaperPortfolio`, `StockPaperTrade`) and actual user holdings (`Stock`, `Transaction`).
3. **Reset Behavior**:
   - Verify single-click virtual equity reset cleanly re-initializes equity to ₹1,00,000 without orphan records.

### B. Strategy Backtester
1. **Execution Assumptions & Lookahead Bias**:
   - Audit walk-forward rules to guarantee signals computed on Day $T$ close are strictly executed on Day $T+1$ open.
   - Ensure realistic gap slippage (0.2%) and delivery statutory costs are applied to both entry and exit legs.
2. **Data Sufficiency & Survivorship Bias**:
   - Ensure the backtester gracefully rejects stocks with fewer than 150 daily bars rather than computing misleading annualized metrics.
   - Clarify benchmark comparisons (Nifty 50 vs. strategy basket).

---

## 3. How to Re-enable in Frontend

When re-evaluation and verification are complete:

1. **Web (`app/stock-intelligence/StockIntelligenceClient.tsx`)**:
   - Unhide the `"Paper Trading Sandbox"` and `"Historical Backtester"` tab buttons in the tab bar.
   - Re-enable the `"Simulate"` button on candidate buy cards.
2. **Mobile (`mobile/src/app/stock-intelligence.tsx`)**:
   - Add `"Sandbox"` and `"Backtest"` back to `styles.tabContainer` segmented control.
   - Re-enable the `"Simulate"` button in the buy card action row.

