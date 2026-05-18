import DashboardOverview from "./components/DashboardOverview";
import InsightsPanel from "./components/InsightsPanel";
import AffordabilityWidget from "./components/AffordabilityWidget";
import GoalsWidget from "./components/GoalsWidget";

export default async function DashboardPage() {
    return (
        <div className="mx-auto max-w-6xl space-y-6">
            <DashboardOverview />
            <div className="grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2">
                    <GoalsWidget />
                </div>
                <div className="space-y-6">
                    <InsightsPanel />
                    <AffordabilityWidget price={200000} />
                    <a
                        href="/subscriptions"
                        className="text-sm font-semibold text-muted-foreground transition hover:text-foreground"
                    >
                        Manage subscriptions
                    </a>
                </div>
            </div>
        </div>
    );
}
