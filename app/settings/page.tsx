import React from "react";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import SettingsClient from "./SettingsClient";

export default async function SettingsPage() {
    return (
        <div className="h-screen overflow-hidden">
            <div className="flex h-full">
                <Sidebar />
                <div className="flex-1 overflow-y-auto">
                    <Header />
                    <main id="main" className="px-6 py-8 lg:px-10">
                        <div className="mx-auto max-w-4xl space-y-6">
                            <SettingsClient />
                        </div>
                    </main>
                </div>
            </div>
        </div>
    );
}
