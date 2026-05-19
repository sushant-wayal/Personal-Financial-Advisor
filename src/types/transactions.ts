export type TransactionListItem = {
    id: string;
    amount: number;
    merchant: string;
    timestamp: string | Date;
    type: string;
    transactionType: string | null;
    paymentMethod: string | null;
    bankName: string | null;
    notes: string | null;
    confidence: number | null;
    category: { id: string; name: string } | null;
};

export type TransactionListResponse = {
    data: TransactionListItem[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
};
