"use client";

import React from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import Header from "./Header";
import MobileNav from "./MobileNav";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isLoginPage = pathname === "/login";

    if (isLoginPage) {
        return <>{children}</>;
    }

    return (
        <>
            <div className="flex h-full w-full">
                <Sidebar />
                <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                    <Header />
                    <main id="main" className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-24 sm:px-6 sm:py-6 lg:px-8 lg:py-6 lg:pb-6">
                        {children}
                    </main>
                </div>
            </div>
            <MobileNav />
        </>
    );
}
