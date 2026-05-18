import React from "react";
import GoalsManager from "./GoalsManager";

export default async function GoalsPage() {
    return (
        <div className="mx-auto max-w-5xl space-y-6">
            <div>
                <div className="text-sm font-semibold text-foreground">Goals</div>
                <div className="text-xs text-muted-foreground">Long-term targets and milestones</div>
            </div>
            <GoalsManager />
        </div>
    );
}
