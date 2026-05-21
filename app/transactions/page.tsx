import { Suspense } from "react";
import TransactionsClient from "./TransactionsClient";

function LoadingFallback() {
    return (
        <div className="space-y-4">
            <div className="h-10 bg-gray-200 rounded animate-pulse" />
            <div className="h-64 bg-gray-200 rounded animate-pulse" />
        </div>
    );
}

export default function TransactionsPage() {
    return (
        <div>
            <h1 className="text-2xl font-bold mb-4">Transactions</h1>
            <Suspense fallback={<LoadingFallback />}>
                <TransactionsClient />
            </Suspense>
        </div>
    );
}
