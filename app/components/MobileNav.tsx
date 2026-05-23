"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DollarSign, Home, MessageCircle, PieChart, Settings } from "lucide-react";

const navItems = [
    { label: "Dashboard", icon: Home, href: "/" },
    { label: "Transactions", icon: PieChart, href: "/transactions" },
    { label: "Goals", icon: DollarSign, href: "/goals" },
    { label: "Advisor", icon: MessageCircle, href: "/advisor" },
    { label: "Settings", icon: Settings, href: "/settings" },
];

export default function MobileNav() {
    const pathname = usePathname();

    return (
        <nav
            aria-label="Primary"
            className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-2 backdrop-blur lg:hidden"
        >
            <div className="grid grid-cols-5 gap-1">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;

                    return (
                        <Link
                            key={item.label}
                            href={item.href}
                            aria-current={isActive ? "page" : undefined}
                            className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-[11px] font-medium transition ${isActive
                                    ? "bg-muted text-foreground shadow-sm"
                                    : "text-muted-foreground active:scale-[0.98]"
                                }`}
                        >
                            <Icon size={18} className={isActive ? "text-foreground" : "text-muted-foreground"} />
                            <span className="leading-none">{item.label}</span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}