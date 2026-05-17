import React from "react";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import Card from "../../src/components/ui/Card";

export default async function SubscriptionsPage() {
    // server component: fetch subscriptions
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/subscriptions/detect`, { method: "POST", cache: "no-store" });
    const data = await res.json();
    const subs = data.detected || [];

    return (
        <div className="h-screen overflow-hidden">
            <div className="flex h-full">
                <Sidebar />
                <div className="flex-1 overflow-y-auto">
                    <Header />
                    <main id="main" className="px-6 py-8 lg:px-10">
                        <div className="mx-auto max-w-5xl space-y-6">
                            <div>
                                <div className="text-sm font-semibold text-white">Subscriptions</div>
                                <div className="text-xs text-slate-400">Recurring charges to keep in sight</div>
                            </div>
                            <div className="grid gap-3">
                                {subs.length === 0 && <div className="text-sm text-slate-500">No recurring subscriptions detected.</div>}
                                {subs.map((s: any) => (
                                    <Card key={s.id}>
                                        <div className="flex flex-wrap items-center justify-between gap-4">
                                            <div>
                                                <div className="font-medium text-slate-100">{s.merchant}</div>
                                                <div className="text-xs text-slate-500">₹{s.amount} / {s.interval}</div>
                                            </div>
                                            <div className="text-xs text-slate-400">Next: {s.nextCharge ? new Date(s.nextCharge).toLocaleDateString() : "-"}</div>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    </main>
                </div>
            </div>
        </div>
    );
}
