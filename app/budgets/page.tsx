import { Suspense } from "react";
import BudgetsClient from "./BudgetsClient";

export const metadata = {
    title: "Budgets | Personal Finance OS",
    description: "Manage monthly category budgets, track spending limits, and view transactions.",
};

function LoadingFallback() {
    return (
        <div className="space-y-6">
            <div className="h-10 w-48 rounded-xl bg-muted animate-pulse" />
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="h-48 rounded-2xl bg-muted animate-pulse" />
                ))}
            </div>
        </div>
    );
}

export default function BudgetsPage() {
    return (
        <Suspense fallback={<LoadingFallback />}>
            <BudgetsClient />
        </Suspense>
    );
}
