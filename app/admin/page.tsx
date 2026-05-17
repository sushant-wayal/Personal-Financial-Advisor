import TransactionsAdminClient from "./TransactionsAdminClient";
import AIMemoryAdmin from "./AIMemoryAdmin";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";

export default function AdminPage() {
    return (
        <div className="min-h-screen">
            <div className="flex">
                <Sidebar />
                <div className="flex-1">
                    <Header />
                    <main id="main" className="px-6 py-8 lg:px-10">
                        <div className="mx-auto max-w-5xl space-y-6">
                            <div>
                                <div className="text-sm font-semibold text-white">Admin Console</div>
                                <div className="text-xs text-slate-400">Operational tools for transactions and memory</div>
                            </div>
                            <TransactionsAdminClient />
                            <AIMemoryAdmin />
                        </div>
                    </main>
                </div>
            </div>
        </div>
    );
}
