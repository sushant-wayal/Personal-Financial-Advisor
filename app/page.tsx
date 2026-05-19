import Link from "next/link";
import DashboardOverview from "./components/DashboardOverview";
import AffordabilityWidget from "./components/AffordabilityWidget";
import GoalsWidget from "./components/GoalsWidget";

export default async function DashboardPage() {
    return (
        <div className="mx-auto max-w-7xl space-y-6">
            <DashboardOverview />
            <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
                <div>
                    <GoalsWidget />
                </div>
                <div className="space-y-6">
                    <AffordabilityWidget price={200000} />
                    <Link
                        href="/subscriptions"
                        className="text-sm font-semibold text-muted-foreground transition hover:text-foreground"
                    >
                        Manage subscriptions
                    </Link>
                </div>
            </div>
        </div>
    );
}
