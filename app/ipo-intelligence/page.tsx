import React from "react";
import IpoIntelligenceClient from "./IpoIntelligenceClient";

export const metadata = {
  title: "IPO Intelligence | North",
  description: "Institutional Indian IPO recommendation engine with real-time subscription demand, GMP analytics, and personal capital allocation.",
};

export default function IpoIntelligencePage() {
  return <IpoIntelligenceClient />;
}
