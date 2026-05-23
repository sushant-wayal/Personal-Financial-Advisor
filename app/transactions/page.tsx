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
        <div className="space-y-4">
            <div>
                <h1 className="text-2xl font-bold sm:text-3xl mb-2">Transactions</h1>
                <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">Review, filter, and edit your transaction history.</p>
            </div>
            <Suspense fallback={<LoadingFallback />}>
                <TransactionsClient />
            </Suspense>
        </div>
    );
}
