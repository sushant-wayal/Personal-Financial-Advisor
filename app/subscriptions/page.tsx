"use client";

import SubscriptionsClient from "./SubscriptionsClient";

export default function SubscriptionsPage() {
    return (
        <div className="mx-auto max-w-5xl space-y-6">
            <div>
                <div className="text-sm font-semibold text-white">Subscriptions</div>
                <div className="text-xs text-slate-400">Recurring charges to keep in sight</div>
            </div>
            <SubscriptionsClient />
        </div>
    );
}
