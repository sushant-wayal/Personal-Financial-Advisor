export type TransactionRecord = {
    id?: string;
    amount: number;
    merchant: string;
    category?: string;
    timestamp?: string | Date;
    source?: string;
    account?: string;
    paymentMethod?: string;
    bankName?: string;
    transactionType?: "DEBIT" | "CREDIT" | "TRANSFER" | "SALARY" | "REFUND" | "SUBSCRIPTION" | "OTHER";
    type?: "DEBIT" | "CREDIT" | "TRANSFER" | "SALARY" | "REFUND" | "SUBSCRIPTION" | "OTHER";
    notes?: string;
    confidence?: number;
    rawText?: string;
    raw?: string;
};
