import TransactionsAdminClient from "./TransactionsAdminClient";
import AIMemoryAdmin from "./AIMemoryAdmin";

export default function AdminPage() {
    return (
        <div className="mx-auto max-w-5xl space-y-6">
            <div>
                <div className="text-sm font-semibold text-foreground">Admin Console</div>
                <div className="text-xs text-muted-foreground">Operational tools for transactions and memory</div>
            </div>
            <TransactionsAdminClient />
            <AIMemoryAdmin />
        </div>
    );
}
