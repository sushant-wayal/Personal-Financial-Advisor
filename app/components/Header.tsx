"use client";

import React, { useState } from "react";
import ThemeToggle from "../../src/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import GmailControls from "./GmailControls";
import NewTransactionDialog from "./NewTransactionDialog";

export default function Header() {
    const dateLabel = new Date().toLocaleString("default", { month: "long", year: "numeric" });
    const [isNewTransactionOpen, setIsNewTransactionOpen] = useState(false);

    return (
        <header className="sticky top-0 z-10 border-b border-border bg-background/95 px-4 py-3 backdrop-blur sm:px-6 sm:py-4 lg:px-8" role="banner">
            <div className="flex flex-col gap-3 sm:gap-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-muted-foreground sm:text-xs sm:tracking-[0.3em]">Overview</div>
                        <div className="truncate text-lg font-semibold text-foreground sm:text-xl">Personal Finance OS</div>
                    </div>
                    <div className="hidden items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs text-muted-foreground md:flex">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        Live sync
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <div className="rounded-full border border-border bg-muted/50 px-3 py-1 text-xs text-muted-foreground">
                        {dateLabel}
                    </div>
                    <div className="hidden sm:block">
                        <GmailControls />
                    </div>
                    <Button size="sm" className="rounded-lg" onClick={() => setIsNewTransactionOpen(true)}>
                        New transaction
                    </Button>
                    <ThemeToggle />
                </div>
            </div>
            <NewTransactionDialog open={isNewTransactionOpen} onOpenChange={setIsNewTransactionOpen} />
        </header>
    );
}
