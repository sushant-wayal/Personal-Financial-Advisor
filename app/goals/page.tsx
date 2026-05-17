import React from "react";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import GoalsManager from "./GoalsManager";

export default async function GoalsPage() {
    return (
        <div className="h-screen overflow-hidden">
            <div className="flex h-full">
                <Sidebar />
                <div className="flex-1 overflow-y-auto">
                    <Header />
                    <main id="main" className="px-6 py-8 lg:px-10">
                        <div className="mx-auto max-w-5xl space-y-6">
                            <div>
                                <div className="text-sm font-semibold text-white">Goals</div>
                                <div className="text-xs text-slate-400">Long-term targets and milestones</div>
                            </div>
                            <GoalsManager />
                        </div>
                    </main>
                </div>
            </div>
        </div>
    );
}
