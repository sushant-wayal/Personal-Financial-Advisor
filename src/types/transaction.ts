export type TransactionRecord = {
    id?: string;
    amount: number;
    merchant: string;
    category?: string;
    timestamp?: string | Date;
    source?: string;
    account?: string;
    type?: "DEBIT" | "CREDIT" | "TRANSFER" | "SALARY" | "REFUND" | "SUBSCRIPTION" | "OTHER";
    notes?: string;
    confidence?: number;
    raw?: string;
};
