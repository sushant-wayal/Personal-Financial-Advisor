import React from "react";
import ThemeToggle from "../../src/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import GmailControls from "./GmailControls";

export default function Header() {
    const dateLabel = new Date().toLocaleString("default", { month: "long", year: "numeric" });

    return (
        <header className="sticky top-0 z-10 border-b border-border bg-background/95 px-8 py-5 backdrop-blur" role="banner">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">Overview</div>
                    <div className="text-xl font-semibold text-foreground">Personal Finance OS</div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="hidden items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs text-muted-foreground md:flex">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        Live sync
                    </div>
                    <div className="rounded-full border border-border bg-muted/50 px-3 py-1 text-xs text-muted-foreground">
                        {dateLabel}
                    </div>
                    <GmailControls />
                    <Button size="sm" className={"rounded-lg"}>
                        New transaction
                    </Button>
                    <ThemeToggle />
                </div>
            </div>
        </header>
    );
}
