export type Transaction = {
  id: string;
  amount: number;
  merchant: string | null;
  timestamp: string;
  type?: string | null;
  transactionType?: string | null;
  paymentMethod?: string | null;
  bankName?: string | null;
  notes?: string | null;
  confidence?: number | null;
  isClubbed?: boolean;
  clubbedSourceIds?: string;
  clubbedSources?: string;
  category?: { id?: string; name?: string } | null;
};

export type TransactionFilters = {
  dateRange?: string;
  dateFrom?: string | null;
  dateTo?: string | null;
  category?: string | null;
  type?: string | null;
  amountMin?: number | null;
  amountMax?: number | null;
  merchant?: string | null;
};

export type ClubSource = {
  id: string;
  amount: number;
  merchant: string;
  timestamp: string;
  type: string;
  transactionType: string;
  category?: string | null;
};
