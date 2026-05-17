import React from "react";
import { Home, PieChart, MessageCircle, DollarSign, ShieldCheck, Settings } from "lucide-react";

const navItems = [
    { label: "Dashboard", icon: Home, href: "/" },
    { label: "Transactions", icon: PieChart, href: "/dashboard" },
    { label: "Goals", icon: DollarSign, href: "/goals" },
    { label: "Advisor", icon: MessageCircle, href: "/advisor" },
    { label: "Settings", icon: Settings, href: "/settings" },
    { label: "Admin", icon: ShieldCheck, href: "/admin" },
];

export default function Sidebar() {
    return (
        <aside className="hidden h-full w-72 shrink-0 border-r border-white/10 bg-slate-950/80 px-5 py-6 backdrop-blur lg:flex lg:flex-col">
            <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400/30 via-sky-300/20 to-emerald-300/30 text-sm font-semibold text-cyan-100">
                    PF
                </div>
                <div>
                    <div className="text-sm uppercase tracking-[0.2em] text-slate-400">Personal</div>
                    <div className="text-lg font-semibold text-white">Finance OS</div>
                </div>
            </div>

            <div className="mt-8 text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Workspace</div>
            <nav className="mt-4 flex flex-col gap-1">
                {navItems.map((item, index) => {
                    const Icon = item.icon;
                    return (
                        <a
                            key={item.label}
                            href={item.href}
                            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${index === 0
                                ? "bg-white/10 text-white"
                                : "text-slate-300 hover:bg-white/5 hover:text-white"
                                }`}
                            aria-current={index === 0 ? "page" : undefined}
                        >
                            <Icon size={16} className="text-slate-400" />
                            <span>{item.label}</span>
                        </a>
                    );
                })}
            </nav>

            <div className="mt-auto rounded-xl border border-white/10 bg-white/5 p-4 text-xs text-slate-300">
                <div className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Active</div>
                <div className="mt-2 text-sm text-white">Financial health model</div>
                <div className="mt-1 text-slate-400">Signals synced 2 minutes ago</div>
            </div>
        </aside>
    );
}
