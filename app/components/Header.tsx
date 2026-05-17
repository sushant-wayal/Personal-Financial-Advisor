import React from "react";
import ThemeToggle from "../../src/components/ThemeToggle";
import Button from "../../src/components/ui/Button";
import GmailControls from "./GmailControls";

export default function Header() {
    const dateLabel = new Date().toLocaleString("default", { month: "long", year: "numeric" });

    return (
        <header className="sticky top-0 z-10 border-b border-white/10 bg-slate-950/80 px-8 py-5 backdrop-blur" role="banner">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Overview</div>
                    <div className="text-xl font-semibold text-white">Personal Finance OS</div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300 md:flex">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        Live sync
                    </div>
                    <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                        {dateLabel}
                    </div>
                    <GmailControls />
                    <Button variant="outline" size="sm">
                        New transaction
                    </Button>
                    <ThemeToggle />
                </div>
            </div>
        </header>
    );
}
