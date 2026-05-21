import React from "react";
import GoalsManager from "./GoalsManager";

export default async function GoalsPage() {
    return (
        <div className="w-full space-y-6 px-4 sm:px-6 lg:px-8">
            <div>
                <div className="text-sm font-semibold text-foreground">Goals</div>
                <div className="text-xs text-muted-foreground">Long-term targets and milestones</div>
            </div>
            <GoalsManager />
        </div>
    );
}
