# API Reference — North Personal Financial Advisor

All endpoints are hosted under `/api/*` and return JSON responses.

---

## 1. Goals API (`/api/goals`)

### `GET /api/goals`
Returns all financial goals and their progress metrics.

**Response**:
```json
{
  "ok": true,
  "goals": [
    {
      "id": "cuid-string",
      "title": "Emergency Fund",
      "targetAmount": 300000,
      "currentAmount": 150000,
      "spentAmount": 0,
      "priority": 1,
      "targetDate": "2027-12-31T00:00:00.000Z",
      "requiredMonthly": 7500,
      "progressPct": 50
    }
  ]
}
```

### `POST /api/goals`
Creates a new financial goal.

**Request Body**:
```json
{
  "title": "New Car",
  "targetAmount": 800000,
  "priority": 2,
  "initialAllocation": 50000,
  "targetDate": "2028-06-30"
}
```

---

## 2. Transactions API (`/api/transactions`)

### `GET /api/transactions`
Retrieves a paginated list of transactions.

**Query Parameters**:
- `page` (number, default: 1)
- `limit` (number, default: 50)
- `category` (string, optional)
- `startDate` (ISO string, optional)
- `endDate` (ISO string, optional)

### `POST /api/transactions`
Ingests a single transaction or raw transaction text.

**Request Body**:
```json
{
  "raw": "Paid Rs 450.00 to Swiggy on 05-Nov using UPI",
  "source": "MANUAL"
}
```

---

## 3. Autonomous AI Advisor API (`/api/ai/advisor`)

### `POST /api/ai/advisor`
Submits a user prompt to the Gemini agentic loop.

**Request Body**:
```json
{
  "message": "Can I afford to buy a ₹60,000 laptop this month?",
  "sessionId": "optional-session-id"
}
```

**Response**:
```json
{
  "reply": "Based on your current monthly surplus of ₹24,500 and priority 1 goal allocations...",
  "artifacts": [
    {
      "type": "AFFORDABILITY_ANALYSIS",
      "title": "Laptop Purchase Assessment",
      "data": { "verdict": "DEFER", "shortfall": 35500 }
    }
  ]
}
```

### `GET /api/ai/advisor/status`
Polls real-time loop execution phase from Redis (`thinking`, `querying`, `processing`, `done`).

---

## 4. Stock & IPO Intelligence APIs

- `GET /api/stock-intelligence`: Returns algorithmic stock scores, momentum ratings, and recommendations.
- `GET /api/ipo-intelligence`: Lists upcoming and open IPOs with risk-weighted subscription recommendations.

---

## 5. System Health & Cron

- `GET /api/cron`: Scheduled trigger for daily pre-computations, exchange calendar sync, and subscription alerts.

