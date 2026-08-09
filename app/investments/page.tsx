import React from "react";
import InvestmentsClient from "./InvestmentsClient";

export const metadata = {
    title: "Monthly Investments | Personal Financial Advisor",
    description: "Dynamic percentage-of-surplus investment strategy, allocations, and history.",
};

export default function InvestmentsPage() {
    return <InvestmentsClient />;
}
