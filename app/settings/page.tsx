import React from "react";
import AIMemoryAdmin from "../admin/AIMemoryAdmin";
import SettingsClient from "./SettingsClient";

export default async function SettingsPage() {
    return (
        <div className="mx-auto w-full max-w-7xl px-4 space-y-6">
            <SettingsClient />
            <section className="space-y-3">
                <div>
                    <div className="text-sm font-semibold text-foreground">AI Memory</div>
                    <div className="text-xs text-muted-foreground">Saved notes used for future responses</div>
                </div>
                <AIMemoryAdmin />
            </section>
        </div>
    );
}
