import DashboardOverview from "../components/DashboardOverview";
import InsightsPanel from "../components/InsightsPanel";
import AffordabilityWidget from "../components/AffordabilityWidget";
import GoalsWidget from "../components/GoalsWidget";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";

export default async function DashboardPage() {
    return (
        <div className="min-h-screen">
            <div className="flex">
                <Sidebar />
                <div className="flex-1">
                    <Header />
                    <main id="main" className="px-6 py-8 lg:px-10">
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
                                        className="inline-flex items-center text-sm font-semibold text-cyan-200 transition hover:text-cyan-100"
                                    >
                                        Manage subscriptions
                                    </a>
                                </div>
                            </div>
                        </div>
                    </main>
                </div>
            </div>
        </div>
    );
}
