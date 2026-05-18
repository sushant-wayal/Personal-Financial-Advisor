"use client";
import React from "react";
import { usePathname } from "next/navigation";
import { Home, PieChart, MessageCircle, DollarSign, ShieldCheck, Settings } from "lucide-react";

const navItems = [
    { label: "Dashboard", icon: Home, href: "/" },
    { label: "Transactions", icon: PieChart, href: "/transactions" },
    { label: "Goals", icon: DollarSign, href: "/goals" },
    { label: "Advisor", icon: MessageCircle, href: "/advisor" },
    { label: "Settings", icon: Settings, href: "/settings" },
    { label: "Admin", icon: ShieldCheck, href: "/admin" },
];

export default function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="hidden h-full w-72 shrink-0 border-r border-border bg-background/95 px-5 py-6 backdrop-blur lg:flex lg:flex-col">
            <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400/30 via-sky-300/20 to-emerald-300/30 text-sm font-semibold text-cyan-100">
                    PF
                </div>
                <div>
                    <div className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Personal</div>
                    <div className="text-lg font-semibold text-foreground">Finance OS</div>
                </div>
            </div>

            <div className="mt-8 text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">Workspace</div>
            <nav className="mt-4 flex flex-col gap-1">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;
                    return (
                        <a
                            key={item.label}
                            href={item.href}
                            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${isActive
                                ? "bg-muted text-foreground"
                                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                                }`}
                            aria-current={isActive ? "page" : undefined}
                        >
                            <Icon size={16} className="text-muted-foreground" />
                            <span>{item.label}</span>
                        </a>
                    );
                })}
            </nav>

            <div className="mt-auto rounded-xl border border-border bg-muted/40 p-4 text-xs text-muted-foreground">
                <div className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Active</div>
                <div className="mt-2 text-sm text-foreground">Financial health model</div>
                <div className="mt-1 text-muted-foreground">Signals synced 2 minutes ago</div>
            </div>
        </aside>
    );
}
