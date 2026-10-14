import React from "react";
import StockIntelligenceClient from "./StockIntelligenceClient";

export const metadata = {
  title: "Stock Intelligence | North",
  description: "AI-assisted quantitative Indian equity swing-trading engine with personal finance risk controls.",
};

export default function StockIntelligencePage() {
  return <StockIntelligenceClient />;
}
