import TransactionsClient from "./TransactionsClient";

export default function TransactionsPage() {
    return (
        <div>
            <h1 className="text-2xl font-bold mb-4">Transactions</h1>
            <TransactionsClient />
        </div>
    );
}
