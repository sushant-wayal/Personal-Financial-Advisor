import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Skeleton, TransactionsSkeleton } from "../components/LoadingSkeleton";
import { getCurrencySymbol, useCurrency } from "../providers/CurrencyProvider";
import { API_BASE_URL } from "../lib/apiBaseUrl";
import { beginHorizontalScroll, endHorizontalScroll, updateHorizontalScroll } from "../lib/horizontalScrollPriority";
import { clearClientCache, fetchCachedValue } from "../lib/clientCache";

type Transaction = {
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
  category?: { id?: string; name?: string } | null;
};

type TransactionFilters = {
  dateRange?: string;
  dateFrom?: string | null;
  dateTo?: string | null;
  category?: string | null;
  type?: string | null;
  amountMin?: number | null;
  amountMax?: number | null;
  merchant?: string | null;
};

type SheetName = "advanced" | "time" | "category" | "type" | null;
type AddPickerName = "merchant" | "category" | "method" | "type" | "date" | null;

const TIME_OPTIONS = [
  { id: "all", label: "All Time" },
  { id: "today", label: "Today" },
  { id: "last7", label: "Last 7 days" },
  { id: "last30", label: "Last 30 days" },
  { id: "last90", label: "Last 90 days" },
  { id: "this_month", label: "This Month" },
  { id: "last_month", label: "Last Month" },
  { id: "custom", label: "Custom Range" },
];

const EXTRA_CATEGORIES = [
  "Food",
  "Groceries",
  "Transport",
  "Bills",
  "Shopping",
  "Entertainment",
  "Education",
  "Miscellaneous",
  "Rent",
  "Healthcare",
  "Subscription",
  "Travel",
  "Investment",
  "Insurance",
  "Salary",
  "Refund",
];
const EXTRA_TYPES = ["Income", "Expense"];
const FALLBACK_TYPES = ["Debit", "Credit", ...EXTRA_TYPES];
const ADD_TRANSACTION_TYPES = ["Debit", "Credit", "Salary", "Refund", "Transfer", "Subscription", "Income", "Expense"];
const CREDIT_TRANSACTION_TYPES = new Set(["Credit", "Salary", "Refund", "Income"]);
const DEBIT_TRANSACTION_TYPES = new Set(["Debit", "Transfer", "Subscription", "Expense"]);
const PAYMENT_METHODS = [
  { label: "UPI", description: "Unified Payments Interface", icon: "qr-code-scanner" },
  { label: "Net Banking", description: "Direct bank transfer", icon: "account-balance" },
  { label: "IMPS", description: "Immediate payment", icon: "send-to-mobile" },
  { label: "NEFT", description: "National electronic transfer", icon: "account-balance" },
  { label: "RTGS", description: "Real-time gross settlement", icon: "forward-to-inbox" },
  { label: "Card", description: "Credit or Debit", icon: "credit-card" },
  { label: "Wallet", description: "Digital balance", icon: "account-balance-wallet" },
  { label: "Cash", description: "Physical currency", icon: "payments" },
];

function apiUrl(path: string) {
  return `${API_BASE_URL}${path}`;
}

async function fetchTransactions(page = 1, pageSize = 50, filters?: TransactionFilters, force = false) {
  const url = new URL(apiUrl("/api/transactions/list"));
  url.searchParams.set("page", String(page));
  url.searchParams.set("pageSize", String(pageSize));

  if (filters) {
    if (filters.dateRange) url.searchParams.set("dateRange", filters.dateRange);
    if (filters.dateFrom) url.searchParams.set("dateFrom", filters.dateFrom);
    if (filters.dateTo) url.searchParams.set("dateTo", filters.dateTo);
    if (filters.category) url.searchParams.set("category", filters.category);
    if (filters.type) url.searchParams.set("type", filters.type);
    if (filters.amountMin !== undefined && filters.amountMin !== null) url.searchParams.set("amountMin", String(filters.amountMin));
    if (filters.amountMax !== undefined && filters.amountMax !== null) url.searchParams.set("amountMax", String(filters.amountMax));
    if (filters.merchant) url.searchParams.set("merchant", filters.merchant);
  }

  return fetchCachedValue(
    url.toString(),
    async () => {
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Failed to load transactions");
      const payload = await res.json();
      return (payload.transactions ?? payload.data ?? []) as Transaction[];
    },
    { force },
  );
}

async function fetchCategories(force = false) {
  return fetchCachedValue(
    "transactions:categories",
    async () => {
      try {
        const res = await fetch(apiUrl("/api/categories"));
        if (!res.ok) return [] as { id: string; name: string }[];
        const payload = await res.json();
        return (Array.isArray(payload) ? payload : payload.data ?? []) as { id: string; name: string }[];
      } catch {
        return [] as { id: string; name: string }[];
      }
    },
    { force },
  );
}

async function fetchOptions(force = false) {
  return fetchCachedValue(
    "transactions:options",
    async () => {
      try {
        const res = await fetch(apiUrl("/api/transactions/options"));
        if (!res.ok) return { transactionTypes: [], paymentMethods: [] };
        return (await res.json()) as { transactionTypes: string[]; paymentMethods: string[] };
      } catch {
        return { transactionTypes: [], paymentMethods: [] };
      }
    },
    { force },
  );
}

async function createTransaction(input: {
  amount: number;
  merchant: string;
  category: string;
  paymentMethod: string;
  bankName: string;
  transactionType: string;
  timestamp: string;
  notes: string;
}) {
  const res = await fetch(apiUrl("/api/transactions"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: input.amount,
      merchant: input.merchant,
      category: input.category,
      paymentMethod: input.paymentMethod,
      bankName: input.bankName || undefined,
      transactionType: input.transactionType,
      timestamp: input.timestamp,
      notes: input.notes || undefined,
      source: "manual",
      confidence: 1,
    }),
  });

  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(payload?.error || "Failed to add transaction");
  }
  return payload;
}

async function updateTransaction(id: string, input: {
  amount: number;
  merchant: string;
  category: string;
  paymentMethod: string;
  bankName: string;
  transactionType: string;
  timestamp: string;
  notes: string;
}) {
  const res = await fetch(apiUrl(`/api/transactions/${id}`), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: input.amount,
      merchant: input.merchant,
      category: input.category,
      paymentMethod: input.paymentMethod,
      bankName: input.bankName || null,
      transactionType: input.transactionType,
      timestamp: input.timestamp,
      notes: input.notes || null,
    }),
  });

  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(payload?.error || "Failed to update transaction");
  }
  return payload;
}

async function deleteTransaction(id: string) {
  const res = await fetch(apiUrl(`/api/transactions/${id}`), { method: "DELETE" });
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(payload?.error || "Failed to delete transaction");
  }
  return payload;
}

async function clubTransactions(input: {
  transactionIds: string[];
  merchant: string;
  category: string;
  paymentMethod: string;
  bankName: string;
  transactionType: string;
  notes: string;
}) {
  const res = await fetch(apiUrl("/api/transactions/club"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok) throw new Error(payload?.error || "Failed to club transactions");
  return payload;
}

function formatDate(value?: string) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

function TransactionsListFooterSkeleton() {
  return (
    <View style={styles.listFooterSkeleton}>
      <View style={styles.listFooterTopRow}>
        <Skeleton width="44%" height={16} />
        <Skeleton width={72} height={18} radius={9} />
      </View>
      <Skeleton width="68%" height={12} radius={6} />
      <Skeleton width="88%" height={12} radius={6} />
      <View style={styles.listFooterActionRow}>
        <Skeleton width={96} height={38} radius={19} />
        <Skeleton width={96} height={38} radius={19} />
      </View>
    </View>
  );
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(value?: string | null) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function monthTitle(date: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(date);
}

function compactDateLabel(value?: string | null) {
  const date = parseDateKey(value);
  if (!date) return "--";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

function fullDateLabel(value?: string | null) {
  const date = parseDateKey(value);
  if (!date) return "--";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function formatDateTimeLabel(dateKey: string, hour: string, minute: string) {
  const hourNum = Number(hour);
  const suffix = hourNum >= 12 ? "PM" : "AM";
  const displayHour = hourNum % 12 || 12;
  return `${fullDateLabel(dateKey)} · ${String(displayHour).padStart(2, "0")}:${minute} ${suffix}`;
}

function dateTimeToIso(dateKey: string, hour: string, minute: string) {
  const date = parseDateKey(dateKey) ?? new Date();
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), Number(hour), Number(minute), 0).toISOString();
}

function datePartsFromTimestamp(value?: string) {
  const date = value ? new Date(value) : new Date();
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  return {
    dateKey: toDateKey(safeDate),
    hour: String(safeDate.getHours()).padStart(2, "0"),
    minute: String(safeDate.getMinutes()).padStart(2, "0"),
    month: new Date(safeDate.getFullYear(), safeDate.getMonth(), 1),
  };
}

function buildCalendarDays(monthDate: Date) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const start = new Date(year, month, 1 - firstOfMonth.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
    return {
      date,
      key: toDateKey(date),
      day: date.getDate(),
      inMonth: date.getMonth() === month,
    };
  });
}

function compareDateKeys(a?: string | null, b?: string | null) {
  if (!a || !b) return 0;
  return a.localeCompare(b);
}

function clampTransactionDateTime(dateKey: string, hour: string, minute: string) {
  const now = new Date();
  const todayKey = toDateKey(now);
  const nextDateKey = compareDateKeys(dateKey, todayKey) > 0 ? todayKey : dateKey;
  let nextHour = hour;
  let nextMinute = minute;

  if (nextDateKey === todayKey) {
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    if (Number(nextHour) > currentHour) {
      nextHour = String(currentHour).padStart(2, "0");
      nextMinute = String(currentMinute).padStart(2, "0");
    } else if (Number(nextHour) === currentHour && Number(nextMinute) > currentMinute) {
      nextMinute = String(currentMinute).padStart(2, "0");
    }
  }

  return { dateKey: nextDateKey, hour: nextHour, minute: nextMinute };
}

function mergeUniqueTransactions(current: Transaction[], incoming: Transaction[]) {
  const seen = new Set(current.map((item) => item.id).filter(Boolean));
  const next = [...current];

  incoming.forEach((item) => {
    if (!item.id || seen.has(item.id)) return;
    seen.add(item.id);
    next.push(item);
  });

  return next;
}

function isCreditTransaction(tx: Transaction) {
  const incomeTypes = ["CREDIT", "SALARY", "REFUND", "INCOME", "BONUS"];
  const expenseTypes = ["DEBIT", "SUBSCRIPTION", "TRANSFER", "PAYMENT", "BILL", "CHARGE", "EXPENSE", "PURCHASE", "WITHDRAWAL"];
  const typeVal = tx.transactionType ?? tx.type ?? null;

  if (typeVal) {
    const up = String(typeVal).toUpperCase();
    if (incomeTypes.includes(up)) return true;
    if (expenseTypes.includes(up)) return false;
  }

  if ((tx.amount ?? 0) > 0) return true;

  const values = [tx.paymentMethod, tx.notes, tx.category?.name, tx.merchant];
  const text = values.filter(Boolean).map((v) => String(v).toLowerCase()).join(" ");
  return ["credit", "salary", "refund", "deposit", "income", "pay-in"].some((keyword) => text.includes(keyword));
}

export default function TransactionsScreen() {
  useCurrency();
  const router = useRouter();
  const statusBarHeight = Platform.OS === "android" ? StatusBar.currentHeight ?? 0 : 0;
  const [items, setItems] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false);

  const [timeRange, setTimeRange] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [options, setOptions] = useState<{ transactionTypes: string[]; paymentMethods: string[] }>({ transactionTypes: [], paymentMethods: [] });
  const [categoryQuery, setCategoryQuery] = useState("");

  const [filterSearch, setFilterSearch] = useState("");
  const [filterMerchant, setFilterMerchant] = useState("");
  const [filterMin, setFilterMin] = useState("");
  const [filterMax, setFilterMax] = useState("");
  const [customModalVisible, setCustomModalVisible] = useState(false);
  const [customFrom, setCustomFrom] = useState(toDateKey(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [customTo, setCustomTo] = useState(toDateKey(new Date()));
  const [visibleMonth, setVisibleMonth] = useState(new Date());
  const [addVisible, setAddVisible] = useState(false);
  const [addPicker, setAddPicker] = useState<AddPickerName>(null);
  const [addAmount, setAddAmount] = useState("");
  const [addMerchant, setAddMerchant] = useState("");
  const [addCategory, setAddCategory] = useState("");
  const [addMethod, setAddMethod] = useState("");
  const [addBank, setAddBank] = useState("");
  const [addType, setAddType] = useState("DEBIT");
  const [addDateKey, setAddDateKey] = useState(toDateKey(new Date()));
  const [addDateMonth, setAddDateMonth] = useState(new Date());
  const [addHour, setAddHour] = useState(String(new Date().getHours()).padStart(2, "0"));
  const [addMinute, setAddMinute] = useState(String(new Date().getMinutes()).padStart(2, "0"));
  const [addNotes, setAddNotes] = useState("");
  const [addCategoryQuery, setAddCategoryQuery] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [savingTransaction, setSavingTransaction] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [actionTransaction, setActionTransaction] = useState<Transaction | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingTransaction, setDeletingTransaction] = useState(false);
  const [clubMode, setClubMode] = useState(false);
  const [selectedForClub, setSelectedForClub] = useState<Set<string>>(() => new Set());
  const [clubSourceIds, setClubSourceIds] = useState<string[]>([]);

  const insets = useSafeAreaInsets();

  const [activeSheet, setActiveSheet] = useState<SheetName>(null);
  const [sheetAnim] = useState(() => new Animated.Value(0));
  const sheetTranslateY = useMemo(() => sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [680, 0] }), [sheetAnim]);
  const currencySymbol = getCurrencySymbol();

  const hasActiveFilters =
    timeRange !== "all" ||
    selectedCategory !== null ||
    selectedType !== null ||
    Boolean(filterSearch || filterMerchant || filterMin || filterMax);
  const timeLabel = TIME_OPTIONS.find((option) => option.id === timeRange)?.label ?? "All Time";
  const customRangeLabel = timeRange === "custom" ? `${compactDateLabel(customFrom)} - ${compactDateLabel(customTo)}` : timeLabel;
  const calendarDays = useMemo(() => buildCalendarDays(visibleMonth), [visibleMonth]);
  const addCalendarDays = useMemo(() => buildCalendarDays(addDateMonth), [addDateMonth]);
  const todayKey = toDateKey(new Date());
  const nowHour = new Date().getHours();
  const nowMinute = new Date().getMinutes();
  const addHourOptions = useMemo(() => {
    const maxHour = addDateKey === todayKey ? nowHour : 23;
    return Array.from({ length: maxHour + 1 }, (_, index) => String(index).padStart(2, "0"));
  }, [addDateKey, nowHour, todayKey]);
  const addMinuteOptions = useMemo(() => {
    const maxMinute = addDateKey === todayKey && Number(addHour) === nowHour ? nowMinute : 59;
    return Array.from({ length: maxMinute + 1 }, (_, index) => String(index).padStart(2, "0"));
  }, [addDateKey, addHour, nowHour, nowMinute, todayKey]);
  const categoryOptions = useMemo(() => {
    const normalized = new Map<string, { id: string; name: string }>();

    [...categories, ...EXTRA_CATEGORIES.map((name) => ({ id: `extra-${name.toLowerCase()}`, name }))].forEach((category) => {
      const key = category.name.trim().toLowerCase();
      if (key && !normalized.has(key)) {
        normalized.set(key, category);
      }
    });

    return Array.from(normalized.values());
  }, [categories]);

  const transactionTypes = useMemo(() => {
    const remoteTypes = options.transactionTypes?.length ? options.transactionTypes : [];
    const normalized = new Map<string, string>();

    [...remoteTypes, ...FALLBACK_TYPES].forEach((type) => {
      const label = String(type).trim();
      const key = label.toLowerCase();
      if (label && !normalized.has(key)) {
        normalized.set(key, label);
      }
    });

    return Array.from(normalized.values());
  }, [options.transactionTypes]);

  const visibleCategories = useMemo(() => {
    if (!categoryQuery.trim()) return categoryOptions;
    const query = categoryQuery.trim().toLowerCase();
    return categoryOptions.filter((category) => category.name.toLowerCase().includes(query));
  }, [categoryOptions, categoryQuery]);

  const visibleAddCategories = useMemo(() => {
    if (!addCategoryQuery.trim()) return categoryOptions;
    const query = addCategoryQuery.trim().toLowerCase();
    return categoryOptions.filter((category) => category.name.toLowerCase().includes(query));
  }, [addCategoryQuery, categoryOptions]);
  const clubMerchantOptions = useMemo(() => {
    const names = clubSourceIds
      .map((id) => items.find((item) => item.id === id)?.merchant?.trim())
      .filter((merchant): merchant is string => Boolean(merchant));
    return Array.from(new Set(names));
  }, [clubSourceIds, items]);
  const eligibleAddTransactionTypes = useMemo(() => {
    if (!clubSourceIds.length) return ADD_TRANSACTION_TYPES;
    const netAmount = clubSourceIds.reduce((total, id) => {
      const transaction = items.find((item) => item.id === id);
      if (!transaction) return total;
      return total + (isCreditTransaction(transaction) ? Math.abs(transaction.amount) : -Math.abs(transaction.amount));
    }, 0);
    const eligibleTypes = netAmount >= 0 ? CREDIT_TRANSACTION_TYPES : DEBIT_TRANSACTION_TYPES;
    return ADD_TRANSACTION_TYPES.filter((type) => eligibleTypes.has(type));
  }, [clubSourceIds, items]);

  const buildFilters = useCallback(
    (overrides: Partial<TransactionFilters> = {}) => ({
      dateRange: overrides.dateRange ?? timeRange,
      dateFrom: overrides.dateFrom === undefined ? (timeRange === "custom" ? customFrom : undefined) : overrides.dateFrom,
      dateTo: overrides.dateTo === undefined ? (timeRange === "custom" ? customTo : undefined) : overrides.dateTo,
      category: overrides.category === undefined ? selectedCategory : overrides.category,
      type: overrides.type === undefined ? selectedType : overrides.type,
      merchant: overrides.merchant === undefined ? filterMerchant || filterSearch || undefined : overrides.merchant,
      amountMin: overrides.amountMin === undefined ? (filterMin ? Number(filterMin) : undefined) : overrides.amountMin,
      amountMax: overrides.amountMax === undefined ? (filterMax ? Number(filterMax) : undefined) : overrides.amountMax,
    }),
    [customFrom, customTo, filterMax, filterMerchant, filterMin, filterSearch, selectedCategory, selectedType, timeRange],
  );

  const loadPage = useCallback(
    async (nextPage = 1, filters: TransactionFilters = buildFilters(), replace = true, force = false) => {
      setError(null);
      const data = await fetchTransactions(nextPage, pageSize, filters, force);
      setItems((current) => (replace ? mergeUniqueTransactions([], data) : mergeUniqueTransactions(current, data)));
      setPage(nextPage);
      setHasMore(data.length === pageSize);
    },
    [buildFilters, pageSize],
  );

  const reload = useCallback(
    async (filters?: TransactionFilters, force = false) => {
      setLoading(true);
      try {
        await loadPage(1, filters ?? buildFilters(), true, force);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    },
    [buildFilters, loadPage],
  );

  useEffect(() => {
    let mounted = true;

    async function hydrate() {
      try {
        const [cats, opts] = await Promise.all([fetchCategories(), fetchOptions()]);
        if (!mounted) return;
        setCategories(cats);
        setOptions(opts);
        const data = await fetchTransactions(1, pageSize, { dateRange: "all" });
        if (!mounted) return;
        setItems(data);
        setPage(1);
        setHasMore(data.length === pageSize);
      } catch (e: unknown) {
        if (mounted) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void hydrate();
    return () => {
      mounted = false;
    };
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadPage(1, buildFilters(), true, true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRefreshing(false);
    }
  }, [buildFilters, loadPage]);

  function openSheet(name: Exclude<SheetName, null>) {
    setActiveSheet(name);
    sheetAnim.setValue(0);
    Animated.timing(sheetAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }

  function closeSheet() {
    Animated.timing(sheetAnim, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => setActiveSheet(null));
  }

  function resetAddForm() {
    const now = new Date();
    setAddAmount("");
    setAddMerchant("");
    setAddCategory("");
    setAddMethod("");
    setAddBank("");
    setAddType("DEBIT");
    setAddDateKey(toDateKey(now));
    setAddDateMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setAddHour(String(now.getHours()).padStart(2, "0"));
    setAddMinute(String(now.getMinutes()).padStart(2, "0"));
    setAddNotes("");
    setAddCategoryQuery("");
    setAddError(null);
    setAddPicker(null);
    setEditingTransaction(null);
  }

  function openAddFlow() {
    resetAddForm();
    setAddVisible(true);
  }

  function cancelClubMode() {
    setClubMode(false);
    setSelectedForClub(new Set());
  }

  function toggleClubSelection(tx: Transaction) {
    if (tx.isClubbed) return;
    setSelectedForClub((current) => {
      const next = new Set(current);
      if (next.has(tx.id)) next.delete(tx.id);
      else next.add(tx.id);
      return next;
    });
  }

  function beginClubSelection(tx: Transaction) {
    if (tx.isClubbed) return;
    setClubMode(true);
    setSelectedForClub(new Set([tx.id]));
  }

  function openClubFlow() {
    const selected = items.filter((item) => selectedForClub.has(item.id));
    if (selected.length < 2) return;
    const latest = selected.reduce((current, item) =>
      new Date(item.timestamp).getTime() > new Date(current.timestamp).getTime() ? item : current,
    );
    const netAmount = selected.reduce(
      (total, item) => total + (isCreditTransaction(item) ? Math.abs(item.amount) : -Math.abs(item.amount)),
      0,
    );
    const parts = datePartsFromTimestamp(latest.timestamp);
    const latestDate = parseDateKey(parts.dateKey) ?? new Date();

    resetAddForm();
    setClubSourceIds(selected.map((item) => item.id));
    setAddAmount(Math.abs(netAmount).toFixed(2));
    setAddMerchant(latest.merchant ?? selected[0].merchant ?? "");
    setAddCategory(latest.category?.name ?? "");
    setAddMethod(latest.paymentMethod ?? "");
    setAddBank(latest.bankName ?? "");
    setAddType(netAmount >= 0 ? "CREDIT" : "DEBIT");
    setAddDateKey(parts.dateKey);
    setAddDateMonth(new Date(latestDate.getFullYear(), latestDate.getMonth(), 1));
    setAddHour(parts.hour);
    setAddMinute(parts.minute);
    setAddNotes("");
    setAddVisible(true);
  }

  function openEditFlow(tx: Transaction) {
    const parts = datePartsFromTimestamp(tx.timestamp);
    const clamped = clampTransactionDateTime(parts.dateKey, parts.hour, parts.minute);
    const clampedDate = parseDateKey(clamped.dateKey) ?? new Date();
    setEditingTransaction(tx);
    setAddAmount(String(Math.abs(tx.amount ?? 0)));
    setAddMerchant(tx.merchant ?? "");
    setAddCategory(tx.category?.name ?? "");
    setAddMethod(tx.paymentMethod ?? "");
    setAddBank(tx.bankName ?? "");
    setAddType(String(tx.transactionType ?? tx.type ?? "DEBIT").toUpperCase());
    setAddDateKey(clamped.dateKey);
    setAddDateMonth(new Date(clampedDate.getFullYear(), clampedDate.getMonth(), 1));
    setAddHour(clamped.hour);
    setAddMinute(clamped.minute);
    setAddNotes(tx.notes ?? "");
    setAddCategoryQuery("");
    setAddError(null);
    setAddPicker(null);
    setActionTransaction(null);
    setAddVisible(true);
  }

  async function saveTransaction() {
    const amount = Number(addAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setAddError("Enter a valid amount.");
      return;
    }
    if (!addMerchant.trim()) {
      setAddError("Merchant is required.");
      return;
    }
    if (!addCategory) {
      setAddError("Select a category.");
      return;
    }
    if (!addMethod) {
      setAddError("Select a payment method.");
      return;
    }
    if (new Date(dateTimeToIso(addDateKey, addHour, addMinute)).getTime() > Date.now()) {
      setAddError("Date and time cannot be in the future.");
      return;
    }

    setSavingTransaction(true);
    setAddError(null);
    try {
      const payload = {
        amount,
        merchant: addMerchant.trim(),
        category: addCategory,
        paymentMethod: addMethod,
        bankName: addBank.trim(),
        transactionType: addType,
        timestamp: dateTimeToIso(addDateKey, addHour, addMinute),
        notes: addNotes.trim(),
      };

      if (clubSourceIds.length) {
        await clubTransactions({
          transactionIds: clubSourceIds,
          merchant: payload.merchant,
          category: payload.category,
          paymentMethod: payload.paymentMethod,
          bankName: payload.bankName,
          transactionType: payload.transactionType,
          notes: payload.notes,
        });
      } else if (editingTransaction) {
        await updateTransaction(editingTransaction.id, payload);
      } else {
        await createTransaction(payload);
      }
      clearClientCache();
      setAddVisible(false);
      setAddPicker(null);
      setEditingTransaction(null);
      setClubSourceIds([]);
      cancelClubMode();
      await reload(buildFilters(), true);
    } catch (e: unknown) {
      setAddError(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingTransaction(false);
    }
  }

  async function confirmDeleteTransaction() {
    if (!deleteTarget) return;
    setDeletingTransaction(true);
    setDeleteError(null);
    try {
      await deleteTransaction(deleteTarget.id);
      setItems((current) => current.filter((item) => item.id !== deleteTarget.id));
      clearClientCache();
      setDeleteTarget(null);
      setActionTransaction(null);
      await reload(buildFilters(), true);
    } catch (e: unknown) {
      setDeleteError(e instanceof Error ? e.message : String(e));
    } finally {
      setDeletingTransaction(false);
    }
  }

  async function applyTimeRange(nextRange: string) {
    if (nextRange === "custom") {
      closeSheet();
      setCustomModalVisible(true);
      const selectedStart = parseDateKey(customFrom);
      if (selectedStart) {
        setVisibleMonth(new Date(selectedStart.getFullYear(), selectedStart.getMonth(), 1));
      }
      return;
    }

    setTimeRange(nextRange);
    closeSheet();
    await reload(buildFilters({ dateRange: nextRange, dateFrom: null, dateTo: null }));
  }

  function selectCustomDay(dayKey: string) {
    if (!customFrom || (customFrom && customTo)) {
      setCustomFrom(dayKey);
      setCustomTo("");
      return;
    }

    if (compareDateKeys(dayKey, customFrom) < 0) {
      setCustomFrom(dayKey);
      setCustomTo("");
      return;
    }

    setCustomTo(dayKey);
  }

  async function applyCustomRange() {
    if (!customFrom || !customTo) return;
    setTimeRange("custom");
    setCustomModalVisible(false);
    await reload(buildFilters({ dateRange: "custom", dateFrom: customFrom, dateTo: customTo }));
  }

  async function applyCategory(nextCategory: string | null) {
    setSelectedCategory(nextCategory);
    closeSheet();
    await reload(buildFilters({ category: nextCategory }));
  }

  async function applyType(nextType: string | null) {
    setSelectedType(nextType);
    closeSheet();
    await reload(buildFilters({ type: nextType }));
  }

  async function clearAdvancedFilters() {
    setFilterSearch("");
    setFilterMerchant("");
    setFilterMin("");
    setFilterMax("");
    closeSheet();
    await reload(buildFilters({ merchant: null, amountMin: null, amountMax: null }));
  }

  async function clearAllFilters() {
    setTimeRange("all");
    setSelectedCategory(null);
    setSelectedType(null);
    setFilterSearch("");
    setFilterMerchant("");
    setFilterMin("");
    setFilterMax("");
    setCategoryQuery("");
    setCustomModalVisible(false);
    await reload({
      dateRange: "all",
      dateFrom: null,
      dateTo: null,
      category: null,
      type: null,
      merchant: null,
      amountMin: null,
      amountMax: null,
    });
  }

  async function applyAdvancedFilters() {
    closeSheet();
    await reload(buildFilters());
  }

  const loadMore = useCallback(async () => {
    if (!hasMore || loading || refreshing || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      await loadPage(page + 1, buildFilters(), false);
    } catch {
      // Keep pagination quiet; pull to refresh exposes full errors.
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [buildFilters, hasMore, loadPage, loading, page, refreshing]);

  const renderItem = ({ item }: { item: Transaction }) => {
    const merchant = item.merchant ?? "Unknown";
    const date = formatDate(item.timestamp);
    const category = item.category?.name ?? "";
    const method = item.paymentMethod ?? item.transactionType ?? "";
    const bank = item.bankName ?? "";
    const isCredit = isCreditTransaction(item);
    const selected = selectedForClub.has(item.id);

    return (
      <Pressable
        onPress={() => clubMode ? toggleClubSelection(item) : setActionTransaction(item)}
        onLongPress={() => clubMode ? toggleClubSelection(item) : beginClubSelection(item)}
        delayLongPress={350}
        disabled={clubMode && item.isClubbed}
        android_ripple={{ color: "rgba(255,255,255,0.025)" }}
        style={({ pressed }) => [styles.row, selected ? styles.rowSelected : null, clubMode && item.isClubbed ? styles.rowDisabled : null, pressed ? styles.rowPressed : null]}
      >
        {clubMode ? (
          <View style={[styles.clubCheckbox, selected ? styles.clubCheckboxSelected : null]}>
            {selected ? <MaterialIcons name="check" size={16} color="#131313" /> : null}
          </View>
        ) : null}
        <View style={styles.rowCopy}>
          <View style={styles.rowTop}>
            <View style={styles.rowTitleGroup}>
              <View style={styles.merchantLine}>
                <Text style={styles.merchant} numberOfLines={1}>{merchant}</Text>
                {item.isClubbed ? (
                  <View style={styles.clubbedBadge}>
                    <MaterialIcons name="call-merge" size={13} color="#d0bcff" />
                    <Text style={styles.clubbedBadgeText}>CLUBBED</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.date}>{date}</Text>
            </View>
            <Text style={[styles.amount, isCredit ? styles.credit : styles.debit]} numberOfLines={1}>
              {isCredit ? "+" : "-"}{currencySymbol}{Math.abs(item.amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
          </View>

          <View style={styles.metaRow}>
            {category ? <Text style={styles.metaText}>{category}</Text> : null}
            {method ? (
              <View style={styles.metaItem}>
                <Text style={styles.metaDot}>•</Text>
                <Text style={styles.metaText}>{method}</Text>
              </View>
            ) : null}
            {bank ? (
              <View style={styles.metaItem}>
                <Text style={styles.metaDot}>•</Text>
                <Text style={styles.metaText}>{bank}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor="#131313" />

      <View style={[styles.header, { paddingTop: statusBarHeight, height: 64 + statusBarHeight }]}>
        <View style={styles.headerTitleRow}>
          <MaterialIcons name="receipt-long" size={24} color="#ffffff" />
          <Text style={styles.headerTitle}>Transactions</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable onPress={() => router.push("/subscriptions")} style={({ pressed }) => [styles.subscriptionBtn, pressed ? styles.headerActionPressed : null]}>
            <MaterialIcons name="date-range" size={20} color="#c4c7c8" />
            <Text style={styles.subscriptionBtnText}>Subs</Text>
          </Pressable>
          <Pressable onPress={openAddFlow} style={({ pressed }) => [styles.addBtn, pressed ? styles.iconPressed : null]}>
            <MaterialIcons name="add" size={24} color="#ffffff" />
          </Pressable>
        </View>
      </View>

      <View style={styles.filterBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContent}
          onTouchStart={beginHorizontalScroll}
          onTouchEnd={endHorizontalScroll}
          onTouchCancel={endHorizontalScroll}
          onScrollBeginDrag={beginHorizontalScroll}
          onScrollEndDrag={endHorizontalScroll}
          onMomentumScrollEnd={endHorizontalScroll}
          onScroll={(event) => {
            const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
            updateHorizontalScroll(contentOffset.x, layoutMeasurement.width, contentSize.width);
          }}
          scrollEventThrottle={16}
        >
          {hasActiveFilters ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear all transaction filters"
              onPress={() => void clearAllFilters()}
              style={({ pressed }) => [styles.clearFiltersChip, pressed ? styles.chipPressed : null]}
            >
              <MaterialIcons name="filter-alt-off" size={18} color="#ffb4ab" />
            </Pressable>
          ) : null}
          <Pressable onPress={() => openSheet("advanced")} style={({ pressed }) => [styles.chip, pressed ? styles.chipPressed : null]}>
            <MaterialIcons name="tune" size={15} color="#e5e2e1" />
            <Text style={styles.chipText}>Filter</Text>
          </Pressable>
          <Pressable onPress={() => openSheet("time")} style={({ pressed }) => [styles.chip, timeRange !== "all" ? styles.chipActive : null, pressed ? styles.chipPressed : null]}>
            <Text style={[styles.chipText, timeRange !== "all" ? styles.chipTextActive : null]}>{customRangeLabel}</Text>
          </Pressable>
          <Pressable onPress={() => openSheet("category")} style={({ pressed }) => [styles.chip, selectedCategory ? styles.chipActive : null, pressed ? styles.chipPressed : null]}>
            <Text style={[styles.chipText, selectedCategory ? styles.chipTextActive : null]}>{selectedCategory ?? "All Categories"}</Text>
          </Pressable>
          <Pressable onPress={() => openSheet("type")} style={({ pressed }) => [styles.chip, selectedType ? styles.chipActive : null, pressed ? styles.chipPressed : null]}>
            <Text style={[styles.chipText, selectedType ? styles.chipTextActive : null]}>{selectedType ?? "All Types"}</Text>
          </Pressable>
        </ScrollView>
      </View>

      <View style={styles.listWrap}>
        {loading ? (
          <TransactionsSkeleton />
        ) : error ? (
          <View style={styles.loadingWrap}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={() => void reload()} style={styles.retryButton}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item, index) => item.id || `${item.timestamp}-${item.merchant ?? "unknown"}-${index}`}
            renderItem={renderItem}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ffffff" />}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyTitle}>No transactions found</Text>
                <Text style={styles.emptyText}>Try clearing filters or refreshing the ledger.</Text>
              </View>
            }
            contentContainerStyle={[styles.listContent, clubMode ? styles.listContentSelecting : null]}
            onEndReached={loadMore}
            onEndReachedThreshold={0.45}
            ListFooterComponent={loadingMore ? <TransactionsListFooterSkeleton /> : null}
          />
        )}
      </View>

      {clubMode ? (
        <View style={[styles.clubActionBar, { bottom: Math.max(insets.bottom + 84, 98) }]}>
          <Pressable accessibilityLabel="Cancel transaction selection" onPress={cancelClubMode} style={styles.clubActionClose}>
            <MaterialIcons name="close" size={20} color="#c4c7c8" />
          </Pressable>
          <View style={styles.clubActionCopy}>
            <Text style={styles.clubActionCount}>{selectedForClub.size} selected</Text>
            {selectedForClub.size === 1 ? <Text style={styles.clubActionHint}>Select at least 2</Text> : null}
          </View>
          <Pressable
            disabled={selectedForClub.size < 2}
            onPress={openClubFlow}
            style={({ pressed }) => [styles.clubActionButton, selectedForClub.size < 2 ? styles.rangeApplyDisabled : null, pressed ? styles.footerPressed : null]}
          >
            <MaterialIcons name="call-merge" size={18} color="#131313" />
            <Text style={styles.clubActionButtonText}>Club</Text>
          </Pressable>
        </View>
      ) : null}

      <Modal visible={!!actionTransaction} transparent animationType="fade" onRequestClose={() => setActionTransaction(null)}>
        <SafeAreaView style={styles.popupSafeArea} edges={["top", "bottom"]}>
          <TouchableWithoutFeedback onPress={() => setActionTransaction(null)}>
            <View style={styles.actionOverlay} />
          </TouchableWithoutFeedback>
          <View style={styles.txActionSheet}>
            <View style={styles.grabHandleCompact} />
            <Text style={styles.txActionTitle} numberOfLines={1}>{actionTransaction?.merchant ?? "Transaction"}</Text>
            <Text style={styles.txActionMeta}>
              {actionTransaction ? `${formatDate(actionTransaction.timestamp)} · ${currencySymbol}${Math.abs(actionTransaction.amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ""}
            </Text>
            <Pressable
              style={({ pressed }) => [styles.txActionOption, pressed ? styles.optionPressed : null]}
              onPress={() => {
                if (actionTransaction) openEditFlow(actionTransaction);
              }}
            >
              <View style={styles.txActionIcon}>
                <MaterialIcons name="edit" size={22} color="#ffffff" />
              </View>
              <Text style={styles.txActionOptionText}>Edit</Text>
              <MaterialIcons name="chevron-right" size={22} color="#8e9192" />
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.txActionOption, styles.txActionDangerOption, pressed ? styles.optionPressed : null]}
              onPress={() => {
                setDeleteError(null);
                setDeleteTarget(actionTransaction);
                setActionTransaction(null);
              }}
            >
              <View style={[styles.txActionIcon, styles.txActionDangerIcon]}>
                <MaterialIcons name="delete-outline" size={22} color="#ffb4ab" />
              </View>
              <Text style={[styles.txActionOptionText, styles.txActionDangerText]}>Delete</Text>
              <MaterialIcons name="chevron-right" size={22} color="#8e9192" />
            </Pressable>
            <Pressable style={({ pressed }) => [styles.txActionCancel, pressed ? styles.footerPressed : null]} onPress={() => setActionTransaction(null)}>
              <Text style={styles.txActionCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>

      <Modal visible={!!deleteTarget} transparent animationType="fade" onRequestClose={() => setDeleteTarget(null)}>
        <SafeAreaView style={styles.confirmOverlay} edges={["top", "bottom"]}>
          <View style={styles.confirmCard}>
            <View style={styles.confirmIcon}>
              <MaterialIcons name="delete-outline" size={26} color="#ffb4ab" />
            </View>
            <Text style={styles.confirmTitle}>Delete transaction?</Text>
            <Text style={styles.confirmBody}>
              This will permanently delete {deleteTarget?.merchant ?? "this transaction"} from your ledger.
            </Text>
            {deleteError ? <Text style={styles.addError}>{deleteError}</Text> : null}
            <View style={styles.confirmActions}>
              <Pressable
                disabled={deletingTransaction}
                style={({ pressed }) => [styles.confirmCancel, pressed ? styles.footerPressed : null]}
                onPress={() => setDeleteTarget(null)}
              >
                <Text style={styles.confirmCancelText}>Go Back</Text>
              </Pressable>
              <Pressable
                disabled={deletingTransaction}
                style={({ pressed }) => [styles.confirmDelete, deletingTransaction ? styles.rangeApplyDisabled : null, pressed ? styles.footerPressed : null]}
                onPress={() => void confirmDeleteTransaction()}
              >
                {deletingTransaction ? <Skeleton width={56} height={16} radius={8} /> : <Text style={styles.confirmDeleteText}>Delete</Text>}
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      <Modal visible={!!activeSheet} transparent animationType="none" onRequestClose={closeSheet}>
        <SafeAreaView style={styles.popupSafeArea} edges={["top", "bottom"]}>
          <TouchableWithoutFeedback onPress={closeSheet}>
            <View style={styles.sheetOverlay} />
          </TouchableWithoutFeedback>

          <Animated.View style={[styles.sheetContainer, sheetStyle(activeSheet), { transform: [{ translateY: sheetTranslateY }] }]}>
            {activeSheet === "advanced" ? (
              <View style={styles.advancedSheet}>
                <View style={styles.grabHandle} />
                <View style={styles.advancedHeader}>
                  <Text style={styles.largeSheetTitle}>Filters</Text>
                  <Pressable onPress={closeSheet} style={({ pressed }) => [styles.sheetIconButton, pressed ? styles.iconPressed : null]}>
                    <MaterialIcons name="close" size={22} color="#c4c7c8" />
                  </Pressable>
                </View>
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.advancedBody}>
                  <View style={styles.sheetSection}>
                    <Text style={styles.sheetLabelSmall}>Global Search</Text>
                    <View style={styles.inputWrap}>
                      <MaterialIcons name="search" size={20} color="#8e9192" style={styles.inputIcon} />
                      <TextInput
                        value={filterSearch}
                        onChangeText={setFilterSearch}
                        placeholder="Keywords, banks, or notes"
                        placeholderTextColor="rgba(196,199,200,0.42)"
                        style={styles.inputWithIcon}
                        returnKeyType="search"
                      />
                    </View>
                  </View>
                  <View style={styles.sheetSection}>
                    <Text style={styles.sheetLabelSmall}>Merchant</Text>
                    <View style={styles.inputWrap}>
                      <MaterialIcons name="storefront" size={20} color="#8e9192" style={styles.inputIcon} />
                      <TextInput
                        value={filterMerchant}
                        onChangeText={setFilterMerchant}
                        placeholder="Specific merchant name"
                        placeholderTextColor="rgba(196,199,200,0.42)"
                        style={styles.inputWithIcon}
                      />
                    </View>
                  </View>
                  <View style={styles.sheetSection}>
                    <Text style={styles.sheetLabelSmall}>Amount Range</Text>
                    <View style={styles.amountRangeWrap}>
                      <View style={styles.amountInputBox}>
                        <Text style={styles.currencyPrefix}>{currencySymbol}</Text>
                        <TextInput
                          value={filterMin}
                          onChangeText={(text) => setFilterMin(text.replace(/[^0-9.]/g, ""))}
                          placeholder="Min"
                          placeholderTextColor="rgba(196,199,200,0.42)"
                          keyboardType="numeric"
                          style={styles.amountInput}
                        />
                      </View>
                      <View style={styles.amountDivider} />
                      <View style={styles.amountInputBox}>
                        <Text style={styles.currencyPrefix}>{currencySymbol}</Text>
                        <TextInput
                          value={filterMax}
                          onChangeText={(text) => setFilterMax(text.replace(/[^0-9.]/g, ""))}
                          placeholder="Max"
                          placeholderTextColor="rgba(196,199,200,0.42)"
                          keyboardType="numeric"
                          style={styles.amountInput}
                        />
                      </View>
                    </View>
                  </View>
                </ScrollView>
                <View style={styles.sheetFooter}>
                  <Pressable style={({ pressed }) => [styles.clearBtn, pressed ? styles.footerPressed : null]} onPress={() => void clearAdvancedFilters()}>
                    <Text style={styles.clearBtnText}>Clear</Text>
                  </Pressable>
                  <Pressable style={({ pressed }) => [styles.applyBtn, pressed ? styles.footerPressed : null]} onPress={() => void applyAdvancedFilters()}>
                    <Text style={styles.applyBtnText}>Apply</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            {activeSheet === "time" ? (
              <View style={styles.sheetContent}>
                <View style={styles.sheetHandleWrap}>
                  <View style={styles.grabHandleCompact} />
                </View>
                <View style={styles.sheetHeaderRow}>
                  <Text style={styles.sheetTitle}>Time Range</Text>
                  <Pressable onPress={closeSheet} style={styles.sheetIconButton}>
                    <MaterialIcons name="close" size={22} color="#c4c7c8" />
                  </Pressable>
                </View>
                <ScrollView contentContainerStyle={styles.optionList}>
                  {TIME_OPTIONS.map((option) => {
                    const selected = timeRange === option.id;
                    return (
                      <Pressable key={option.id} onPress={() => void applyTimeRange(option.id)} style={({ pressed }) => [styles.timeOption, pressed ? styles.optionPressed : null]}>
                        <Text style={[styles.timeOptionText, selected ? styles.timeOptionTextSelected : null]}>{option.label}</Text>
                        <MaterialIcons name={selected ? "radio-button-checked" : "radio-button-unchecked"} size={22} color={selected ? "#05e777" : "#444748"} />
                      </Pressable>
                    );
                  })}
                </ScrollView>
                <View style={styles.singleFooter}>
                  <Pressable style={({ pressed }) => [styles.fullApplyBtn, pressed ? styles.footerPressed : null]} onPress={closeSheet}>
                    <Text style={styles.fullApplyText}>Apply Filter</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            {activeSheet === "category" ? (
              <View style={styles.tallSheet}>
                <View style={styles.centerHeader}>
                  <Pressable onPress={closeSheet} style={styles.sheetIconButton}>
                    <MaterialIcons name="close" size={22} color="#e5e2e1" />
                  </Pressable>
                  <Text pointerEvents="none" style={styles.centerTitle}>Select Category</Text>
                  <View style={styles.headerSpacer} />
                </View>
                <View style={styles.categoryBody}>
                  <View style={styles.searchInputWrap}>
                    <MaterialIcons name="search" size={20} color="#c4c7c8" style={styles.inputIcon} />
                    <TextInput
                      value={categoryQuery}
                      onChangeText={setCategoryQuery}
                      placeholder="Search categories..."
                      placeholderTextColor="#8e9192"
                      style={styles.inputWithIcon}
                    />
                  </View>
                  <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.categoryList}>
                    <CategoryOption label="All" selected={!selectedCategory} icon="category" onPress={() => void applyCategory(null)} />
                    <View style={styles.categoryDivider} />
                    {visibleCategories.map((category) => (
                      <CategoryOption
                        key={category.id ?? category.name}
                        label={category.name}
                        selected={selectedCategory === category.name}
                        icon={categoryIcon(category.name)}
                        onPress={() => void applyCategory(category.name)}
                      />
                    ))}
                  </ScrollView>
                </View>
                <View style={styles.singleFooterOverlay}>
                  <Pressable style={({ pressed }) => [styles.fullApplyBtn, pressed ? styles.footerPressed : null]} onPress={closeSheet}>
                    <Text style={styles.fullApplyText}>Confirm Selection</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            {activeSheet === "type" ? (
              <View style={styles.sheetContent}>
                <View style={styles.sheetHeaderRow}>
                  <Text style={styles.sheetTitle}>Select Type</Text>
                  <Pressable onPress={closeSheet} style={styles.sheetIconButton}>
                    <MaterialIcons name="close" size={22} color="#c4c7c8" />
                  </Pressable>
                </View>
                <ScrollView contentContainerStyle={styles.typeList}>
                  <TypeOption label="All Types" selected={!selectedType} onPress={() => void applyType(null)} />
                  {transactionTypes.map((type) => (
                    <TypeOption key={type} label={type} selected={selectedType === type} onPress={() => void applyType(type)} />
                  ))}
                </ScrollView>
                <View style={styles.singleFooter}>
                  <Pressable style={({ pressed }) => [styles.fullApplyBtn, pressed ? styles.footerPressed : null]} onPress={closeSheet}>
                    <Text style={styles.fullApplyText}>Apply</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
          </Animated.View>
        </SafeAreaView>
      </Modal>

      <Modal visible={addVisible} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => (addPicker ? setAddPicker(null) : setAddVisible(false))}>
        {addPicker === null ? (
          <SafeAreaView style={styles.addScreen} edges={["top", "bottom"]}>
            <View style={styles.addHeader}>
              <Text style={styles.addTitle}>{clubSourceIds.length ? "CLUB TRANSACTIONS" : editingTransaction ? "EDIT TRANSACTION" : "ADD NEW TRANSACTION"}</Text>
              <Pressable onPress={() => { setAddVisible(false); setClubSourceIds([]); }} style={({ pressed }) => [styles.sheetIconButton, pressed ? styles.iconPressed : null]}>
                <MaterialIcons name="close" size={22} color="#c4c7c8" />
              </Pressable>
            </View>
            <ScrollView style={styles.addScroll} contentContainerStyle={styles.addContent} showsVerticalScrollIndicator={false}>
              <Text style={styles.addHint}>
                {clubSourceIds.length ? `${clubSourceIds.length} transactions will become one. Amount and time are calculated automatically.` : "Enter the details below. This uses the same spacing and rounded controls as the edit dialog."}
              </Text>

              <View style={styles.addField}>
                <Text style={styles.addLabel}>Amount</Text>
                <View style={styles.addInputWrap}>
                  <Text style={styles.addCurrency}>{currencySymbol}</Text>
                  <TextInput
                    value={addAmount}
                    onChangeText={(text) => setAddAmount(text.replace(/[^0-9.]/g, ""))}
                    editable={!clubSourceIds.length}
                    placeholder="0.00"
                    placeholderTextColor="rgba(196,199,200,0.48)"
                    keyboardType="numeric"
                    style={[styles.addInput, styles.addAmountInput]}
                  />
                </View>
              </View>

              {clubSourceIds.length ? (
                <AddSelectRow label="Merchant" value={addMerchant || "Select a merchant"} muted={!addMerchant} onPress={() => setAddPicker("merchant")} />
              ) : (
                <View style={styles.addField}>
                  <Text style={styles.addLabel}>Merchant</Text>
                  <TextInput value={addMerchant} onChangeText={setAddMerchant} placeholder="Enter merchant name" placeholderTextColor="rgba(196,199,200,0.48)" style={styles.addInput} />
                </View>
              )}

              <AddSelectRow label="Category" value={addCategory || "Select a category"} muted={!addCategory} onPress={() => setAddPicker("category")} />
              <AddSelectRow label="Method" value={addMethod || "Select a payment method"} muted={!addMethod} onPress={() => setAddPicker("method")} />

              <View style={styles.addField}>
                <Text style={styles.addLabel}>Bank</Text>
                <TextInput
                  value={addBank}
                  onChangeText={setAddBank}
                  placeholder="e.g. HDFC"
                  placeholderTextColor="rgba(196,199,200,0.48)"
                  style={styles.addInput}
                />
              </View>

              <AddSelectRow label="Type" value={addType} onPress={() => setAddPicker("type")} compact />
              <AddSelectRow label="Date" value={formatDateTimeLabel(addDateKey, addHour, addMinute)} onPress={() => { if (!clubSourceIds.length) setAddPicker("date"); }} />

              <View style={styles.addField}>
                <Text style={styles.addLabel}>Notes</Text>
                <TextInput
                  value={addNotes}
                  onChangeText={setAddNotes}
                  placeholder="Add details..."
                  placeholderTextColor="rgba(196,199,200,0.48)"
                  multiline
                  textAlignVertical="top"
                  style={[styles.addInput, styles.addTextArea]}
                />
              </View>

              {addError ? <Text style={styles.addError}>{addError}</Text> : null}
            </ScrollView>
            <View style={styles.addFooter}>
              <Pressable style={({ pressed }) => [styles.addCancelButton, pressed ? styles.footerPressed : null]} onPress={() => { setAddVisible(false); setClubSourceIds([]); }}>
                <Text style={styles.addCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                disabled={savingTransaction}
                style={({ pressed }) => [styles.addSaveButton, savingTransaction ? styles.rangeApplyDisabled : null, pressed ? styles.footerPressed : null]}
                onPress={() => void saveTransaction()}
              >
                {savingTransaction ? <Skeleton width={72} height={16} radius={8} /> : <Text style={styles.addSaveText}>{clubSourceIds.length ? "Create Club" : editingTransaction ? "Save Changes" : "Save"}</Text>}
              </Pressable>
            </View>
          </SafeAreaView>
        ) : null}

        {addPicker === "merchant" ? (
          <SafeAreaView style={styles.addPickerScreen} edges={["top", "bottom"]}>
            <View style={styles.addPickerHeader}>
              <Pressable onPress={() => setAddPicker(null)} style={styles.addBackButton}>
                <MaterialIcons name="arrow-back" size={24} color="#c4c7c8" />
              </Pressable>
              <Text pointerEvents="none" style={styles.addPickerTitle}>SELECT MERCHANT</Text>
              <View style={styles.headerSpacer} />
            </View>
            <ScrollView style={styles.addPickerList} showsVerticalScrollIndicator={false}>
              {clubMerchantOptions.map((merchant) => (
                <AddListOption
                  key={merchant}
                  label={merchant}
                  icon="storefront"
                  selected={addMerchant === merchant}
                  onPress={() => { setAddMerchant(merchant); setAddPicker(null); }}
                />
              ))}
            </ScrollView>
          </SafeAreaView>
        ) : null}

        {addPicker === "category" ? (
          <SafeAreaView style={styles.addPickerScreen} edges={["top", "bottom"]}>
            <View style={styles.addPickerHeader}>
              <Pressable onPress={() => setAddPicker(null)} style={styles.addBackButton}>
                <MaterialIcons name="arrow-back" size={24} color="#c4c7c8" />
              </Pressable>
              <Text pointerEvents="none" style={styles.addPickerTitle}>Select Category</Text>
              <View style={styles.headerSpacer} />
            </View>
            <View style={styles.addPickerSearchWrap}>
              <MaterialIcons name="search" size={20} color="#c4c7c8" style={styles.inputIcon} />
              <TextInput
                value={addCategoryQuery}
                onChangeText={setAddCategoryQuery}
                placeholder="Search categories..."
                placeholderTextColor="#8e9192"
                style={styles.inputWithIcon}
              />
            </View>
            <ScrollView style={styles.addPickerList} showsVerticalScrollIndicator={false}>
              {visibleAddCategories.map((category) => (
                <AddListOption
                  key={category.id ?? category.name}
                  label={category.name}
                  icon={categoryIcon(category.name)}
                  selected={addCategory === category.name}
                  onPress={() => {
                    setAddCategory(category.name);
                    setAddPicker(null);
                  }}
                />
              ))}
            </ScrollView>
          </SafeAreaView>
        ) : null}

        {addPicker === "method" ? (
          <SafeAreaView style={styles.addPickerScreen} edges={["top", "bottom"]}>
            <View style={styles.methodHeader}>
              <Pressable onPress={() => setAddPicker(null)} style={styles.methodBackButton}>
                <MaterialIcons name="arrow-back" size={24} color="#c4c7c8" />
              </Pressable>
              <Text style={styles.methodTopLabel}>SELECT METHOD</Text>
            </View>
            <ScrollView contentContainerStyle={styles.methodContent} showsVerticalScrollIndicator={false}>
              <Text style={styles.methodHero}>Assign Payment Method</Text>
              <Text style={styles.methodCopy}>Specify the financial channel used for this transaction to ensure accurate portfolio tracking.</Text>
              {PAYMENT_METHODS.map((method) => (
                <PaymentMethodOption
                  key={method.label}
                  label={method.label}
                  description={method.description}
                  icon={method.icon}
                  selected={addMethod === method.label}
                  onPress={() => {
                    setAddMethod(method.label);
                    setAddPicker(null);
                  }}
                />
              ))}
            </ScrollView>
          </SafeAreaView>
        ) : null}

        {addPicker === "type" ? (
          <SafeAreaView style={styles.addPickerScreen} edges={["top", "bottom"]}>
            <View style={styles.addPickerHeader}>
              <Pressable onPress={() => setAddPicker(null)} style={styles.addBackButton}>
                <MaterialIcons name="arrow-back" size={24} color="#ffffff" />
              </Pressable>
              <Text pointerEvents="none" style={styles.addPickerTitle}>SELECT TYPE</Text>
              <View style={styles.headerSpacer} />
            </View>
            <ScrollView contentContainerStyle={styles.addTypeContent} showsVerticalScrollIndicator={false}>
              {eligibleAddTransactionTypes.map((type) => (
                <AddTypeOption
                  key={type}
                  label={type}
                  selected={addType === type.toUpperCase()}
                  onPress={() => {
                    setAddType(type.toUpperCase());
                    setAddPicker(null);
                  }}
                />
              ))}
            </ScrollView>
          </SafeAreaView>
        ) : null}

        {addPicker === "date" ? (
          <SafeAreaView style={styles.addDateOverlay} edges={["top", "bottom"]}>
            <View style={styles.addDateCard}>
              <View style={styles.addDateHeader}>
                <Text style={styles.addDateTitle}>Select Date & Time</Text>
                <Pressable onPress={() => setAddPicker(null)} style={styles.customCloseButton}>
                  <MaterialIcons name="close" size={24} color="#c4c7c8" />
                </Pressable>
              </View>
              <ScrollView contentContainerStyle={styles.addDateContent} showsVerticalScrollIndicator={false}>
                <View style={styles.dateSummaryCard}>
                  <View>
                    <Text style={styles.dateSummaryLabel}>DATE</Text>
                    <Text style={styles.dateSummaryValue}>{fullDateLabel(addDateKey)}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={styles.dateSummaryLabel}>TIME</Text>
                    <Text style={styles.dateSummaryValue}>{formatDateTimeLabel(addDateKey, addHour, addMinute).split(" · ")[1]}</Text>
                  </View>
                </View>
                <View style={styles.addCalendarHeader}>
                  <Pressable onPress={() => setAddDateMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}>
                    <MaterialIcons name="chevron-left" size={26} color="#c4c7c8" />
                  </Pressable>
                  <Text style={styles.addCalendarMonth}>{monthTitle(addDateMonth)}</Text>
                  <Pressable onPress={() => setAddDateMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}>
                    <MaterialIcons name="chevron-right" size={26} color="#c4c7c8" />
                  </Pressable>
                </View>
                <View style={styles.addWeekdayGrid}>
                  {["SU", "MO", "TU", "WE", "TH", "FR", "SA"].map((day) => <Text key={day} style={styles.addWeekdayText}>{day}</Text>)}
                </View>
                <View style={styles.addDateGrid}>
                  {addCalendarDays.map((day) => {
                    const selected = day.key === addDateKey;
                    const disabled = compareDateKeys(day.key, todayKey) > 0;
                    return (
                      <Pressable key={day.key} disabled={disabled} onPress={() => setAddDateKey(day.key)} style={[styles.addDateCell, selected ? styles.addDateCellSelected : null, disabled ? styles.addDateCellDisabled : null]}>
                        <Text style={[styles.addDateCellText, !day.inMonth || disabled ? styles.dateTextMuted : null, selected ? styles.addDateCellTextSelected : null]}>{day.day}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <View style={styles.timePickerShell}>
                  <View style={styles.timePickerHeader}>
                    <Text style={styles.timePickerLabel}>Hour</Text>
                    <Text style={styles.timePickerLabel}>Minute</Text>
                  </View>
                  <View style={styles.timePickerBox}>
                    <View style={styles.timeHighlight} />
                    <TimeColumn label="Hour" values={addHourOptions} value={addHour} onChange={setAddHour} />
                    <Text style={styles.timeColon}>:</Text>
                    <TimeColumn label="Minute" values={addMinuteOptions} value={addMinute} onChange={setAddMinute} />
                  </View>
                </View>
              </ScrollView>
              <View style={styles.addDateFooter}>
                <Pressable style={styles.rangeCancelButton} onPress={() => setAddPicker(null)}>
                  <Text style={styles.rangeCancelText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.rangeApplyButton} onPress={() => setAddPicker(null)}>
                  <Text style={styles.rangeApplyText}>Set Date</Text>
                </Pressable>
              </View>
            </View>
          </SafeAreaView>
        ) : null}
      </Modal>

      <Modal visible={customModalVisible} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setCustomModalVisible(false)}>
        <SafeAreaView style={styles.customRangeScreen} edges={["top", "bottom"]}>
          <View style={styles.customRangeHeader}>
            <Pressable onPress={() => setCustomModalVisible(false)} style={({ pressed }) => [styles.customCloseButton, pressed ? styles.iconPressed : null]}>
              <MaterialIcons name="close" size={24} color="#c4c7c8" />
            </Pressable>
            <Text pointerEvents="none" style={styles.customRangeTitle}>Custom Range</Text>
            <View style={styles.headerSpacer} />
          </View>

          <ScrollView style={styles.customRangeScroller} contentContainerStyle={styles.customRangeContent} showsVerticalScrollIndicator={false}>
            <View style={styles.selectedDatesPanel}>
              <View style={styles.selectedDateBlock}>
                <Text style={styles.selectedDateLabel}>Start</Text>
                <Text style={styles.selectedDateValue}>{compactDateLabel(customFrom)}</Text>
              </View>
              <View style={styles.selectedArrowWrap}>
                <MaterialIcons name="arrow-right-alt" size={28} color="#8e9192" />
              </View>
              <View style={[styles.selectedDateBlock, styles.selectedDateBlockEnd]}>
                <Text style={styles.selectedDateLabel}>End</Text>
                <Text style={styles.selectedDateValue}>{compactDateLabel(customTo)}</Text>
              </View>
            </View>

            <View style={styles.calendarPanel}>
              <View style={styles.calendarHeader}>
                <Text style={styles.calendarMonth}>{monthTitle(visibleMonth)}</Text>
                <View style={styles.calendarNav}>
                  <Pressable
                    style={({ pressed }) => [styles.calendarNavButton, pressed ? styles.iconPressed : null]}
                    onPress={() => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
                  >
                    <MaterialIcons name="chevron-left" size={26} color="#c4c7c8" />
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.calendarNavButton, pressed ? styles.iconPressed : null]}
                    onPress={() => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
                  >
                    <MaterialIcons name="chevron-right" size={26} color="#c4c7c8" />
                  </Pressable>
                </View>
              </View>

              <View style={styles.weekdayGrid}>
                {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
                  <Text key={`${day}-${index}`} style={styles.weekdayText}>{day}</Text>
                ))}
              </View>

              <View style={styles.calendarGrid}>
                {calendarDays.map((day) => {
                  const hasFullRange = Boolean(customFrom && customTo);
                  const isStart = day.key === customFrom;
                  const isEnd = day.key === customTo;
                  const isInRange = hasFullRange && compareDateKeys(day.key, customFrom) > 0 && compareDateKeys(day.key, customTo) < 0;
                  const isRangeMarked = isStart || isEnd || isInRange;

                  return (
                    <Pressable
                      key={day.key}
                      onPress={() => selectCustomDay(day.key)}
                      style={({ pressed }) => [styles.calendarCell, pressed ? styles.calendarCellPressed : null]}
                    >
                      {isInRange ? <View style={styles.rangeFillFull} /> : null}
                      {isStart && hasFullRange ? <View style={styles.rangeFillRight} /> : null}
                      {isEnd && hasFullRange ? <View style={styles.rangeFillLeft} /> : null}
                      <View style={[styles.dateCircle, isStart || isEnd ? styles.dateCircleActive : null]}>
                        <Text
                          style={[
                            styles.dateText,
                            !day.inMonth ? styles.dateTextMuted : null,
                            isRangeMarked && day.inMonth ? styles.dateTextRange : null,
                            isStart || isEnd ? styles.dateTextActive : null,
                          ]}
                        >
                          {day.day}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          <View style={styles.customRangeFooter}>
            <Pressable style={({ pressed }) => [styles.rangeCancelButton, pressed ? styles.footerPressed : null]} onPress={() => setCustomModalVisible(false)}>
              <Text style={styles.rangeCancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              disabled={!customFrom || !customTo}
              style={({ pressed }) => [styles.rangeApplyButton, !customFrom || !customTo ? styles.rangeApplyDisabled : null, pressed ? styles.footerPressed : null]}
              onPress={() => void applyCustomRange()}
            >
              <Text style={styles.rangeApplyText}>Apply Range</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView >
  );
}

function sheetStyle(activeSheet: SheetName) {
  if (activeSheet === "category") return styles.categorySheetContainer;
  if (activeSheet === "advanced") return styles.advancedSheetContainer;
  if (activeSheet === "type") return styles.typeSheetContainer;
  return styles.standardSheetContainer;
}

function categoryIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes("food") || lower.includes("dining")) return "restaurant";
  if (lower.includes("grocery")) return "shopping-cart";
  if (lower.includes("shop")) return "local-mall";
  if (lower.includes("travel") || lower.includes("transport")) return "directions-car";
  if (lower.includes("health")) return "local-hospital";
  if (lower.includes("bill")) return "receipt";
  if (lower.includes("rent")) return "home";
  if (lower.includes("subscription")) return "subscriptions";
  if (lower.includes("investment")) return "trending-up";
  if (lower.includes("insurance")) return "shield";
  if (lower.includes("salary")) return "work";
  if (lower.includes("refund")) return "settings-backup-restore";
  if (lower.includes("entertainment")) return "movie";
  if (lower.includes("education")) return "school";
  return "category";
}

function CategoryOption({ label, selected, icon, onPress }: { label: string; selected: boolean; icon: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.categoryOption, pressed ? styles.optionPressed : null]}>
      <MaterialIcons name={icon as React.ComponentProps<typeof MaterialIcons>["name"]} size={22} color={selected ? "#ffffff" : "#c4c7c8"} />
      <Text style={styles.categoryLabel}>{label}</Text>
      <View style={[styles.categoryCheck, selected ? styles.categoryCheckSelected : null]}>
        {selected ? <MaterialIcons name="check" size={16} color="#00622e" /> : null}
      </View>
    </Pressable>
  );
}

function TypeOption({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.typeOption, pressed ? styles.optionPressed : null]}>
      <Text style={[styles.typeLabel, selected ? styles.typeLabelSelected : null]}>{label}</Text>
      <View style={[styles.typeRadio, selected ? styles.typeRadioSelected : null]}>
        {selected ? <View style={styles.typeRadioInner} /> : null}
      </View>
    </Pressable>
  );
}

function AddSelectRow({ label, value, muted, compact, onPress }: { label: string; value: string; muted?: boolean; compact?: boolean; onPress: () => void }) {
  return (
    <View style={[styles.addField, compact ? styles.addFieldCompact : null]}>
      <Text style={styles.addLabel}>{label}</Text>
      <Pressable onPress={onPress} style={({ pressed }) => [styles.addSelect, pressed ? styles.optionPressed : null]}>
        <Text style={[styles.addSelectText, muted ? styles.addSelectMuted : null]} numberOfLines={1}>{value}</Text>
        <MaterialIcons name="expand-more" size={22} color="#c4c7c8" />
      </Pressable>
    </View>
  );
}

function AddListOption({ label, icon, selected, onPress }: { label: string; icon: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.addListOption, selected ? styles.addListOptionSelected : null, pressed ? styles.optionPressed : null]}>
      <View style={styles.addListOptionLeft}>
        <View style={[styles.addListIcon, selected ? styles.addListIconSelected : null]}>
          <MaterialIcons name={icon as React.ComponentProps<typeof MaterialIcons>["name"]} size={22} color={selected ? "#ffffff" : "#c4c7c8"} />
        </View>
        <Text style={[styles.addListLabel, selected ? styles.addListLabelSelected : null]}>{label}</Text>
      </View>
      {selected ? <MaterialIcons name="check" size={24} color="#7dffa2" /> : null}
    </Pressable>
  );
}

function PaymentMethodOption({
  label,
  description,
  icon,
  selected,
  onPress,
}: {
  label: string;
  description: string;
  icon: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.methodOption, selected ? styles.methodOptionSelected : null, pressed ? styles.optionPressed : null]}>
      {selected ? <View style={styles.methodAccent} /> : null}
      <View style={[styles.methodIcon, selected ? styles.methodIconSelected : null]}>
        <MaterialIcons name={icon as React.ComponentProps<typeof MaterialIcons>["name"]} size={28} color={selected ? "#131313" : "#c4c7c8"} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.methodLabel, selected ? styles.methodLabelSelected : null]}>{label}</Text>
        <Text style={[styles.methodDescription, selected ? styles.methodDescriptionSelected : null]}>{description}</Text>
      </View>
      {selected ? <MaterialIcons name="check-circle" size={28} color="#7dffa2" /> : null}
    </Pressable>
  );
}

function AddTypeOption({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const icon = label === "Debit" || label === "Expense" ? "remove-circle" : label === "Credit" || label === "Income" ? "add-circle" : label === "Salary" ? "work" : label === "Refund" ? "settings-backup-restore" : label === "Transfer" ? "swap-horiz" : "update";
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.addTypeOption, selected ? styles.addTypeOptionSelected : null, pressed ? styles.optionPressed : null]}>
      <View style={styles.addListOptionLeft}>
        <View style={[styles.addTypeIcon, selected ? styles.addTypeIconSelected : null]}>
          <MaterialIcons name={icon as React.ComponentProps<typeof MaterialIcons>["name"]} size={24} color="#ffffff" />
        </View>
        <Text style={[styles.addTypeLabel, selected ? styles.addTypeLabelSelected : null]}>{label}</Text>
      </View>
      {selected ? <MaterialIcons name="check" size={24} color="#ffffff" /> : null}
    </Pressable>
  );
}

function TimeColumn({ label, values, value, onChange }: { label: string; values: string[]; value: string; onChange: (value: string) => void }) {
  const scrollRef = useRef<ScrollView>(null);
  const selectedIndex = Math.max(0, values.indexOf(value));
  const isInteracting = useRef(false);
  const activeIndexRef = useRef(selectedIndex);
  const itemHeight = 44;
  const [scrollY] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (isInteracting.current) return;
    activeIndexRef.current = selectedIndex;
    scrollY.setValue(selectedIndex * itemHeight);
    const frame = requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: selectedIndex * itemHeight, animated: false });
    });
    return () => cancelAnimationFrame(frame);
  }, [scrollY, selectedIndex]);

  const selectNearest = (offsetY: number, commit = true) => {
    const nextIndex = Math.max(0, Math.min(values.length - 1, Math.round(offsetY / itemHeight)));
    if (nextIndex !== activeIndexRef.current) {
      activeIndexRef.current = nextIndex;
      if (commit) {
        onChange(values[nextIndex]);
      }
    }
  };

  return (
    <Animated.ScrollView
      ref={scrollRef}
      accessibilityLabel={label}
      style={styles.timeColumn}
      contentContainerStyle={styles.timeColumnContent}
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled
      snapToInterval={itemHeight}
      decelerationRate="fast"
      onScrollBeginDrag={() => {
        isInteracting.current = true;
      }}
      onScroll={(event) => {
        const offsetY = event.nativeEvent.contentOffset.y;
        scrollY.setValue(offsetY);
        selectNearest(offsetY);
      }}
      onMomentumScrollEnd={(event) => {
        selectNearest(event.nativeEvent.contentOffset.y);
        isInteracting.current = false;
      }}
      onScrollEndDrag={(event) => {
        selectNearest(event.nativeEvent.contentOffset.y);
        if (!event.nativeEvent.velocity || Math.abs(event.nativeEvent.velocity.y) < 0.1) {
          isInteracting.current = false;
        }
      }}
      scrollEventThrottle={16}
    >
      {values.map((item, index) => {
        const center = index * itemHeight;
        const inputRange = [center - itemHeight * 2, center - itemHeight, center, center + itemHeight, center + itemHeight * 2];
        const scale = scrollY.interpolate({
          inputRange,
          outputRange: [0.82, 0.96, 1.32, 0.96, 0.82],
          extrapolate: "clamp",
        });
        const opacity = scrollY.interpolate({
          inputRange,
          outputRange: [0.28, 0.62, 1, 0.62, 0.28],
          extrapolate: "clamp",
        });
        const color = scrollY.interpolate({
          inputRange,
          outputRange: ["rgba(196,199,200,0.34)", "rgba(229,226,225,0.72)", "#ffffff", "rgba(229,226,225,0.72)", "rgba(196,199,200,0.34)"],
          extrapolate: "clamp",
        });

        return (
          <Pressable key={item} onPress={() => onChange(item)} style={[styles.timeValueButton, { height: itemHeight }]}>
            <Animated.Text
              style={[
                styles.timeValue,
                { color, opacity, transform: [{ scale }] },
              ]}
            >
              {item}
            </Animated.Text>
          </Pressable>
        );
      })}
    </Animated.ScrollView>
  );
}

const fs = (size: number) => Math.round(size * 0.9 * 10) / 10;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A0A0A" },
  header: {
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(19,19,19,0.96)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  headerTitle: { color: "#ffffff", fontSize: fs(24), lineHeight: 32, fontWeight: "600", fontFamily: "Hanken Grotesk" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  addBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  subscriptionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  subscriptionBtnText: { color: "#c4c7c8", fontFamily: "JetBrains Mono", fontSize: fs(10), lineHeight: 14, letterSpacing: 1.1, textTransform: "uppercase", fontWeight: "700" },
  headerActionPressed: { backgroundColor: "rgba(255,255,255,0.05)", transform: [{ scale: 0.95 }] },
  iconPressed: { backgroundColor: "rgba(255,255,255,0.05)", transform: [{ scale: 0.95 }] },
  filterBar: {
    borderBottomWidth: 1,
    borderBottomColor: "#262626",
    backgroundColor: "#0A0A0A",
    paddingVertical: 16,
    shadowColor: "#000000",
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    zIndex: 2,
  },
  filterContent: { paddingHorizontal: 24, alignItems: "center", gap: 8 },
  chip: {
    height: 38,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: "#1A1A1A",
    borderWidth: 1,
    borderColor: "#333333",
    gap: 8,
  },
  chipActive: {
    backgroundColor: "rgba(5,231,119,0.14)",
    borderColor: "#05e777",
  },
  chipText: {
    color: "#e5e2e1",
    fontSize: fs(14),
    lineHeight: 20,
    letterSpacing: 0.7,
    fontWeight: "500",
    fontFamily: "JetBrains Mono",
  },
  chipTextActive: { color: "#7dffa2" },
  clearFiltersChip: {
    height: 38,
    width: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,180,171,0.5)",
    backgroundColor: "rgba(255,180,171,0.08)",
  },
  chipPressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
  listWrap: { flex: 1, paddingHorizontal: 12 },
  listContent: { paddingBottom: 136 },
  listContentSelecting: { paddingBottom: 220 },
  listFooterSkeleton: {
    marginTop: 16,
    padding: 18,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#26282a",
    backgroundColor: "#171819",
    gap: 12,
  },
  listFooterTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  listFooterActionRow: {
    flexDirection: "row",
    gap: 12,
    paddingTop: 4,
  },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  errorText: { color: "#ffb4ab", fontSize: fs(16), textAlign: "center", fontFamily: "Inter" },
  retryButton: { height: 42, paddingHorizontal: 20, borderRadius: 999, borderWidth: 1, borderColor: "#333333", justifyContent: "center" },
  retryText: { color: "#ffffff", fontWeight: "700", textTransform: "uppercase", letterSpacing: 1.4, fontSize: fs(12) },
  emptyWrap: { paddingTop: 96, alignItems: "center", gap: 8 },
  emptyTitle: { color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: fs(22), fontWeight: "700" },
  emptyText: { color: "#8e9192", fontSize: fs(14) },
  row: { paddingVertical: 16, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: "#262626", borderRadius: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  rowPressed: { backgroundColor: "#1F1F1F" },
  rowSelected: { backgroundColor: "rgba(208,188,255,0.11)", borderBottomColor: "rgba(208,188,255,0.22)" },
  rowDisabled: { opacity: 0.42 },
  clubCheckbox: { width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: "#8e9192", alignItems: "center", justifyContent: "center" },
  clubCheckboxSelected: { backgroundColor: "#d0bcff", borderColor: "#d0bcff" },
  rowCopy: { gap: 8, flex: 1, minWidth: 0 },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 14 },
  rowTitleGroup: { flex: 1, minWidth: 0 },
  merchantLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  merchant: { color: "#ffffff", fontSize: fs(16), lineHeight: 24, fontWeight: "500", fontFamily: "Inter" },
  clubbedBadge: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, height: 21, borderRadius: 999, backgroundColor: "rgba(208,188,255,0.12)", borderWidth: 1, borderColor: "rgba(208,188,255,0.35)" },
  clubbedBadgeText: { color: "#d0bcff", fontFamily: "JetBrains Mono", fontSize: fs(8), lineHeight: 11, fontWeight: "800", letterSpacing: 0.7 },
  date: {
    color: "#c4c7c8",
    marginTop: 4,
    fontSize: fs(14),
    lineHeight: 20,
    letterSpacing: 0.7,
    fontWeight: "500",
    fontFamily: "JetBrains Mono",
  },
  metaRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 0 },
  metaText: { color: "#c4c7c8", fontSize: fs(14), lineHeight: 20, fontFamily: "Inter" },
  metaItem: { flexDirection: "row", alignItems: "center" },
  metaDot: { color: "#333333", marginHorizontal: 8, fontSize: fs(25), lineHeight: 20 },
  amount: { minWidth: 118, textAlign: "right", fontFamily: "JetBrains Mono", fontSize: fs(14), lineHeight: 20, fontWeight: "500" },
  debit: { color: "#ffb4ab" },
  credit: { color: "#00e475" },
  clubActionBar: { position: "absolute", left: 16, right: 84, zIndex: 60, minHeight: 76, borderRadius: 20, borderWidth: 1, borderColor: "rgba(208,188,255,0.32)", backgroundColor: "#1a181d", paddingHorizontal: 12, paddingVertical: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, shadowColor: "#000", shadowOpacity: 0.45, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 12 },
  clubActionClose: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.06)" },
  clubActionCopy: { flex: 1 },
  clubActionCount: { color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: fs(17), lineHeight: 22, fontWeight: "700" },
  clubActionHint: { color: "#9d999f", fontFamily: "Inter", fontSize: fs(11), lineHeight: 16 },
  clubActionButton: { height: 44, paddingHorizontal: 16, borderRadius: 999, backgroundColor: "#d0bcff", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  clubActionButtonText: { color: "#131313", fontFamily: "Inter", fontSize: fs(14), fontWeight: "800" },
  actionOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.68)" },
  popupSafeArea: { flex: 1, backgroundColor: "transparent" },
  txActionSheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.14)",
    backgroundColor: "#0e0e0e",
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 34,
    gap: 12,
  },
  txActionTitle: { color: "#ffffff", marginTop: 12, fontFamily: "Hanken Grotesk", fontSize: fs(24), lineHeight: 32, fontWeight: "700" },
  txActionMeta: { color: "#8e9192", marginBottom: 8, fontFamily: "JetBrains Mono", fontSize: fs(13), lineHeight: 18, letterSpacing: 0.4 },
  txActionOption: {
    minHeight: 64,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "#1A1A1A",
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  txActionDangerOption: { borderColor: "rgba(255,180,171,0.18)" },
  txActionIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#2a2a2a", alignItems: "center", justifyContent: "center" },
  txActionDangerIcon: { backgroundColor: "rgba(255,180,171,0.08)" },
  txActionOptionText: { flex: 1, color: "#ffffff", fontFamily: "Inter", fontSize: fs(18), lineHeight: 28, fontWeight: "600" },
  txActionDangerText: { color: "#ffb4ab" },
  txActionCancel: { height: 54, borderRadius: 999, borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", alignItems: "center", justifyContent: "center", marginTop: 6 },
  txActionCancelText: { color: "#ffffff", fontFamily: "JetBrains Mono", fontSize: fs(14), lineHeight: 20, letterSpacing: 1.4, textTransform: "uppercase" },
  confirmOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.74)", alignItems: "center", justifyContent: "center", padding: 24 },
  confirmCard: { width: "100%", borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", backgroundColor: "#131313", padding: 24, gap: 14 },
  confirmIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: "rgba(255,180,171,0.08)", alignItems: "center", justifyContent: "center" },
  confirmTitle: { color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: fs(24), lineHeight: 32, fontWeight: "700" },
  confirmBody: { color: "#c4c7c8", fontFamily: "Inter", fontSize: fs(16), lineHeight: 24 },
  confirmActions: { flexDirection: "row", gap: 14, paddingTop: 8 },
  confirmCancel: { flex: 1, height: 52, borderRadius: 999, borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", alignItems: "center", justifyContent: "center" },
  confirmDelete: { flex: 1, height: 52, borderRadius: 999, backgroundColor: "#ffb4ab", alignItems: "center", justifyContent: "center" },
  confirmCancelText: { color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: fs(14), fontWeight: "700", letterSpacing: 1.6, textTransform: "uppercase" },
  confirmDeleteText: { color: "#690005", fontFamily: "Hanken Grotesk", fontSize: fs(14), fontWeight: "700", letterSpacing: 1.6, textTransform: "uppercase" },
  sheetOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.70)" },
  sheetContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    overflow: "hidden",
    backgroundColor: "#0A0A0A",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
  },
  standardSheetContainer: { maxHeight: 795, borderTopColor: "#444748" },
  typeSheetContainer: { maxHeight: "85%", borderTopColor: "rgba(255,255,255,0.20)" },
  advancedSheetContainer: { maxHeight: "90%", borderTopColor: "rgba(255,255,255,0.20)" },
  categorySheetContainer: { height: "90%", borderTopWidth: 2, borderTopColor: "rgba(255,255,255,0.20)" },
  sheetContent: { backgroundColor: "#131313" },
  advancedSheet: { backgroundColor: "#0A0A0A" },
  grabHandle: { width: 48, height: 6, backgroundColor: "rgba(255,255,255,0.10)", borderRadius: 999, alignSelf: "center", marginTop: 16 },
  sheetHandleWrap: { alignItems: "center", paddingTop: 12, paddingBottom: 4 },
  grabHandleCompact: { width: 48, height: 6, backgroundColor: "rgba(68,71,72,0.50)", borderRadius: 999 },
  advancedHeader: { height: 70, paddingHorizontal: 24, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  largeSheetTitle: { color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: fs(24), lineHeight: 32, fontWeight: "700" },
  sheetIconButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.05)", alignItems: "center", justifyContent: "center", zIndex: 4, elevation: 4 },
  advancedBody: { paddingHorizontal: 24, paddingVertical: 24, gap: 32 },
  sheetSection: { gap: 16 },
  sheetLabelSmall: { color: "#c4c7c8", fontSize: fs(11), letterSpacing: 2.2, textTransform: "uppercase", fontFamily: "Hanken Grotesk", fontWeight: "700" },
  inputWrap: {
    minHeight: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "#1A1A1A",
    justifyContent: "center",
  },
  searchInputWrap: {
    minHeight: 50,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#353534",
    backgroundColor: "#1c1b1b",
    justifyContent: "center",
  },
  inputIcon: { position: "absolute", left: 16, zIndex: 2 },
  inputWithIcon: { minHeight: 54, color: "#ffffff", paddingLeft: 48, paddingRight: 16, fontSize: fs(16), lineHeight: 24, fontFamily: "Inter" },
  amountRangeWrap: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "#1A1A1A",
    padding: 4,
  },
  amountInputBox: { flex: 1, minHeight: 48, justifyContent: "center" },
  currencyPrefix: { position: "absolute", left: 16, color: "#c4c7c8", fontFamily: "JetBrains Mono", fontSize: fs(14) },
  amountInput: { minHeight: 48, color: "#ffffff", paddingLeft: 40, paddingRight: 8, fontSize: fs(16), fontFamily: "Inter" },
  amountDivider: { width: 1, height: 24, backgroundColor: "rgba(255,255,255,0.10)" },
  sheetFooter: { flexDirection: "row", gap: 16, padding: 24, paddingBottom: 48, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.10)" },
  clearBtn: {
    flex: 1,
    height: 56,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  applyBtn: { flex: 1, height: 56, borderRadius: 999, backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center" },
  clearBtnText: { color: "#ffffff", fontSize: fs(14), letterSpacing: 2.1, textTransform: "uppercase", fontFamily: "Hanken Grotesk", fontWeight: "700" },
  applyBtnText: { color: "#000000", fontSize: fs(14), letterSpacing: 2.1, textTransform: "uppercase", fontFamily: "Hanken Grotesk", fontWeight: "700" },
  footerPressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
  sheetHeaderRow: {
    height: 72,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a2a",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sheetTitle: { color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: fs(20), lineHeight: 28, fontWeight: "600" },
  optionList: { paddingHorizontal: 24, paddingVertical: 8 },
  timeOption: { minHeight: 56, borderBottomWidth: 1, borderBottomColor: "#2a2a2a", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  timeOptionText: { color: "#c4c7c8", fontSize: fs(18), lineHeight: 28, fontFamily: "Inter" },
  timeOptionTextSelected: { color: "#ffffff", fontWeight: "500" },
  optionPressed: { backgroundColor: "rgba(255,255,255,0.04)" },
  singleFooter: { padding: 24, paddingBottom: 48, borderTopWidth: 1, borderTopColor: "#2a2a2a", backgroundColor: "#131313" },
  singleFooterOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 24,
    paddingBottom: 48,
    borderTopWidth: 1,
    borderTopColor: "#201f1f",
    backgroundColor: "rgba(14,14,14,0.96)",
  },
  fullApplyBtn: { height: 56, borderRadius: 999, backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center" },
  fullApplyText: { color: "#000000", fontFamily: "Hanken Grotesk", fontSize: fs(18), lineHeight: 22, fontWeight: "700", textTransform: "uppercase" },
  tallSheet: { flex: 1, backgroundColor: "#0e0e0e" },
  centerHeader: {
    height: 64,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#201f1f",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  centerTitle: { color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: fs(24), lineHeight: 32, fontWeight: "600", position: "absolute", left: 0, right: 0, textAlign: "center" },
  headerSpacer: { width: 40, height: 40 },
  categoryBody: { flex: 1, paddingHorizontal: 24, paddingTop: 24 },
  categoryList: { paddingTop: 24, paddingBottom: 144, gap: 4 },
  categoryOption: {
    minHeight: 58,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "transparent",
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  categoryLabel: { flex: 1, color: "#ffffff", fontSize: fs(16), lineHeight: 24, fontFamily: "Inter" },
  categoryCheck: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: "#353534", alignItems: "center", justifyContent: "center" },
  categoryCheckSelected: { borderColor: "#05e777", backgroundColor: "#05e777" },
  categoryDivider: { height: 1, backgroundColor: "#353534", marginHorizontal: 16, marginVertical: 8 },
  typeList: { paddingHorizontal: 24, paddingVertical: 24, gap: 8 },
  typeOption: {
    minHeight: 58,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  typeLabel: { color: "#e5e2e1", fontSize: fs(18), lineHeight: 28, fontFamily: "Inter" },
  typeLabelSelected: { color: "#ffffff", fontWeight: "600" },
  typeRadio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: "#444748", alignItems: "center", justifyContent: "center" },
  typeRadioSelected: { backgroundColor: "#ffffff", borderColor: "#ffffff" },
  typeRadioInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#131313" },
  addScreen: { flex: 1, backgroundColor: "#0e0e0e" },
  addHeader: {
    height: 68,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#262626",
    backgroundColor: "rgba(14,14,14,0.96)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  addTitle: { color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: fs(24), lineHeight: 32, fontWeight: "600" },
  addScroll: { flex: 1 },
  addContent: { padding: 24, paddingBottom: 116, gap: 24 },
  addHint: { color: "#c4c7c8", opacity: 0.8, fontSize: fs(14), lineHeight: 20, fontFamily: "Inter" },
  addField: { gap: 8 },
  addFieldCompact: { width: "52%" },
  addLabel: {
    color: "#c4c7c8",
    fontFamily: "JetBrains Mono",
    fontSize: fs(12),
    lineHeight: 18,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  addInputWrap: { justifyContent: "center" },
  addCurrency: { position: "absolute", left: 12, color: "#c4c7c8", fontFamily: "JetBrains Mono", zIndex: 2 },
  addInput: {
    minHeight: 50,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#333333",
    backgroundColor: "#1A1A1A",
    color: "#ffffff",
    paddingHorizontal: 12,
    fontFamily: "Inter",
    fontSize: fs(16),
    lineHeight: 24,
  },
  addAmountInput: { paddingLeft: 30, paddingRight: 12 },
  addTextArea: { minHeight: 96, paddingTop: 12 },
  addSelect: {
    minHeight: 50,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#333333",
    backgroundColor: "#1A1A1A",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  addSelectText: { flex: 1, color: "#ffffff", fontFamily: "Inter", fontSize: fs(16), lineHeight: 24 },
  addSelectMuted: { color: "rgba(196,199,200,0.62)" },
  addError: { color: "#ffb4ab", fontFamily: "Inter", fontSize: fs(14), lineHeight: 20 },
  addFooter: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: "#262626",
    backgroundColor: "rgba(14,14,14,0.96)",
    flexDirection: "row",
    gap: 16,
  },
  addCancelButton: { flex: 1, height: 50, borderRadius: 8, borderWidth: 1, borderColor: "transparent", alignItems: "center", justifyContent: "center" },
  addSaveButton: { flex: 1, height: 50, borderRadius: 8, backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center" },
  addCancelText: { color: "#ffffff", fontFamily: "JetBrains Mono", fontSize: fs(14), lineHeight: 20, letterSpacing: 1.6, textTransform: "uppercase" },
  addSaveText: { color: "#000000", fontFamily: "JetBrains Mono", fontSize: fs(14), lineHeight: 20, letterSpacing: 1.6, textTransform: "uppercase", fontWeight: "700" },
  addPickerScreen: { flex: 1, backgroundColor: "#0A0A0A" },
  addPickerHeader: {
    height: 72,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#333333",
    backgroundColor: "#1A1A1A",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  addBackButton: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", zIndex: 3 },
  addPickerTitle: {
    color: "#ffffff",
    fontFamily: "Hanken Grotesk",
    fontSize: fs(24),
    lineHeight: 32,
    fontWeight: "600",
    textTransform: "uppercase",
    position: "absolute",
    left: 0,
    right: 0,
    textAlign: "center",
  },
  addPickerSearchWrap: {
    margin: 24,
    marginBottom: 0,
    minHeight: 50,
    borderWidth: 1,
    borderColor: "#333333",
    backgroundColor: "#1A1A1A",
    justifyContent: "center",
  },
  addPickerList: { flex: 1, marginTop: 16 },
  addListOption: {
    minHeight: 72,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#262626",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  addListOptionSelected: { backgroundColor: "#1F1F1F" },
  addListOptionLeft: { flexDirection: "row", alignItems: "center", gap: 16, flex: 1 },
  addListIcon: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: "#333333", backgroundColor: "#201f1f", alignItems: "center", justifyContent: "center" },
  addListIconSelected: { borderColor: "#ffffff" },
  addListLabel: { color: "#c4c7c8", fontFamily: "Inter", fontSize: fs(18), lineHeight: 28 },
  addListLabelSelected: { color: "#ffffff", fontWeight: "500" },
  methodHeader: { height: 80, paddingHorizontal: 24, flexDirection: "row", alignItems: "center", backgroundColor: "rgba(19,19,19,0.96)" },
  methodBackButton: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: "#353534", alignItems: "center", justifyContent: "center", marginRight: 24 },
  methodTopLabel: { color: "#ffffff", fontFamily: "JetBrains Mono", fontSize: fs(14), lineHeight: 20, letterSpacing: 1.8, textTransform: "uppercase" },
  methodContent: { paddingHorizontal: 24, paddingBottom: 40 },
  methodHero: { color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: fs(32), lineHeight: 40, fontWeight: "700", marginTop: 16, marginBottom: 12 },
  methodCopy: { color: "#c4c7c8", fontFamily: "Inter", fontSize: fs(18), lineHeight: 28, marginBottom: 32 },
  methodOption: {
    minHeight: 104,
    marginBottom: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#353534",
    backgroundColor: "#1c1b1b",
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
    overflow: "hidden",
  },
  methodOptionSelected: { backgroundColor: "#201f1f", borderColor: "#ffffff" },
  methodAccent: { position: "absolute", left: 0, top: 0, bottom: 0, width: 4, backgroundColor: "#ffffff" },
  methodIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#353534", alignItems: "center", justifyContent: "center" },
  methodIconSelected: { backgroundColor: "#ffffff" },
  methodLabel: { color: "#e5e2e1", fontFamily: "Hanken Grotesk", fontSize: fs(24), lineHeight: 32, fontWeight: "600" },
  methodLabelSelected: { color: "#ffffff" },
  methodDescription: { color: "rgba(196,199,200,0.74)", fontFamily: "Inter", fontSize: fs(16), lineHeight: 24 },
  methodDescriptionSelected: { color: "#c6c6c7" },
  addTypeContent: { padding: 24, paddingTop: 32, gap: 8 },
  addTypeOption: {
    minHeight: 74,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#353534",
    backgroundColor: "#1c1b1b",
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  addTypeOptionSelected: { backgroundColor: "#201f1f", borderColor: "#ffffff" },
  addTypeIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#201f1f", alignItems: "center", justifyContent: "center" },
  addTypeIconSelected: { backgroundColor: "rgba(255,255,255,0.10)" },
  addTypeLabel: { color: "#e5e2e1", fontFamily: "Inter", fontSize: fs(18), lineHeight: 28 },
  addTypeLabelSelected: { color: "#ffffff", fontWeight: "600" },
  addDateOverlay: { flex: 1, backgroundColor: "#0A0A0A", padding: 16, justifyContent: "center" },
  addDateCard: {
    maxHeight: "96%",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "#171717",
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 16,
  },
  addDateHeader: { minHeight: 76, paddingHorizontal: 24, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  addDateTitle: { color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: fs(24), lineHeight: 32, fontWeight: "600" },
  addDateContent: { padding: 24, gap: 24 },
  dateSummaryCard: { borderRadius: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", backgroundColor: "#101010", padding: 16, flexDirection: "row", justifyContent: "space-between" },
  dateSummaryLabel: { color: "#c4c7c8", fontFamily: "JetBrains Mono", fontSize: fs(12), lineHeight: 18, letterSpacing: 1 },
  dateSummaryValue: { color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: fs(22), lineHeight: 30, fontWeight: "600" },
  addCalendarHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  addCalendarMonth: { color: "#ffffff", fontFamily: "Inter", fontSize: fs(16), lineHeight: 24, fontWeight: "700" },
  addWeekdayGrid: { flexDirection: "row" },
  addWeekdayText: { width: "14.2857%", textAlign: "center", color: "#c4c7c8", fontFamily: "JetBrains Mono", fontSize: fs(10), lineHeight: 16 },
  addDateGrid: { flexDirection: "row", flexWrap: "wrap" },
  addDateCell: { width: "14.2857%", height: 40, borderRadius: 4, alignItems: "center", justifyContent: "center" },
  addDateCellSelected: { backgroundColor: "#ffffff" },
  addDateCellDisabled: { opacity: 0.36 },
  addDateCellText: { color: "#e5e2e1", fontFamily: "Inter", fontSize: fs(16), lineHeight: 24 },
  addDateCellTextSelected: { color: "#131313", fontWeight: "700" },
  timePickerShell: { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.10)", paddingTop: 20 },
  timePickerHeader: { width: 196, alignSelf: "center", flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 8, marginBottom: 8 },
  timePickerLabel: { color: "#8e9192", fontFamily: "JetBrains Mono", fontSize: fs(11), lineHeight: 16, letterSpacing: 1.2, textTransform: "uppercase" },
  timePickerBox: {
    height: 184,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "#101010",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
    overflow: "hidden",
  },
  timeHighlight: {
    position: "absolute",
    top: 70,
    height: 44,
    width: 232,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  timeColumn: { width: 72, height: 184 },
  timeColumnContent: { paddingVertical: 70, alignItems: "center" },
  timeValueButton: { width: 72, alignItems: "center", justifyContent: "center" },
  timeValue: { color: "rgba(196,199,200,0.46)", fontFamily: "Hanken Grotesk", fontSize: fs(22), lineHeight: 30 },
  timeValueNear: { color: "rgba(196,199,200,0.72)" },
  timeValueFar: { color: "rgba(196,199,200,0.30)" },
  timeValueSelected: { color: "#ffffff", fontSize: fs(30), lineHeight: 38, fontWeight: "700" },
  timeColon: { color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: fs(32), lineHeight: 40, fontWeight: "700", marginTop: -2 },
  addDateFooter: { padding: 24, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)", flexDirection: "row", gap: 16, backgroundColor: "#131313" },
  customRangeScreen: { flex: 1, backgroundColor: "#131313" },
  customRangeHeader: {
    height: 64,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.10)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  customCloseButton: { width: 40, height: 40, marginLeft: -8, borderRadius: 20, alignItems: "center", justifyContent: "center", zIndex: 3 },
  customRangeTitle: {
    color: "#ffffff",
    fontFamily: "Hanken Grotesk",
    fontSize: fs(24),
    lineHeight: 32,
    fontWeight: "600",
    position: "absolute",
    left: 0,
    right: 0,
    textAlign: "center",
  },
  customRangeScroller: { flex: 1 },
  customRangeContent: { paddingBottom: 132 },
  selectedDatesPanel: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectedDateBlock: { flex: 1 },
  selectedDateBlockEnd: { alignItems: "flex-end" },
  selectedDateLabel: {
    color: "#c4c7c8",
    marginBottom: 4,
    fontFamily: "JetBrains Mono",
    fontSize: fs(14),
    lineHeight: 20,
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  selectedDateValue: { color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: fs(32), lineHeight: 40, fontWeight: "700" },
  selectedArrowWrap: { paddingHorizontal: 16 },
  calendarPanel: { paddingHorizontal: 24, paddingTop: 32 },
  calendarHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 24 },
  calendarMonth: { color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: fs(24), lineHeight: 32, fontWeight: "600" },
  calendarNav: { flexDirection: "row", alignItems: "center", gap: 8 },
  calendarNavButton: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  weekdayGrid: { flexDirection: "row", marginBottom: 16 },
  weekdayText: {
    width: "14.2857%",
    textAlign: "center",
    color: "#8e9192",
    fontFamily: "JetBrains Mono",
    fontSize: fs(14),
    lineHeight: 20,
    letterSpacing: 0.7,
  },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap" },
  calendarCell: { width: "14.2857%", height: 64, alignItems: "center", justifyContent: "center" },
  calendarCellPressed: { opacity: 0.72 },
  dateCircle: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", zIndex: 2 },
  dateCircleActive: { backgroundColor: "#ffffff" },
  dateText: { color: "#e5e2e1", fontFamily: "Inter", fontSize: fs(18), lineHeight: 28 },
  dateTextMuted: { color: "#444748" },
  dateTextRange: { color: "#ffffff" },
  dateTextActive: { color: "#131313", fontWeight: "700" },
  rangeFillFull: { position: "absolute", left: 0, right: 0, top: 12, bottom: 12, backgroundColor: "#2a2a2a" },
  rangeFillRight: { position: "absolute", left: "50%", right: 0, top: 12, bottom: 12, backgroundColor: "#2a2a2a" },
  rangeFillLeft: { position: "absolute", left: 0, right: "50%", top: 12, bottom: 12, backgroundColor: "#2a2a2a" },
  customRangeFooter: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.05)",
    backgroundColor: "rgba(19,19,19,0.98)",
    flexDirection: "row",
    gap: 16,
  },
  rangeCancelButton: { flex: 1, height: 54, borderRadius: 8, borderWidth: 1, borderColor: "#8e9192", alignItems: "center", justifyContent: "center" },
  rangeApplyButton: { flex: 1, height: 54, borderRadius: 8, backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center" },
  rangeApplyDisabled: { opacity: 0.38 },
  rangeCancelText: { color: "#ffffff", fontFamily: "JetBrains Mono", fontSize: fs(14), lineHeight: 20, letterSpacing: 0.7, fontWeight: "500" },
  rangeApplyText: { color: "#131313", fontFamily: "JetBrains Mono", fontSize: fs(14), lineHeight: 20, letterSpacing: 0.7, fontWeight: "700" },
  customModalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.72)", alignItems: "center", justifyContent: "center", padding: 24 },
  customModal: { width: "100%", borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", backgroundColor: "#131313", padding: 24, gap: 18 },
  customTitle: { color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: fs(24), lineHeight: 32, fontWeight: "700" },
  customHint: { color: "#8e9192", fontSize: fs(14), lineHeight: 20 },
  customField: { gap: 10 },
  plainInput: { minHeight: 54, borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", backgroundColor: "#1A1A1A", color: "#ffffff", paddingHorizontal: 16, fontSize: fs(16) },
  customActions: { flexDirection: "row", gap: 14, paddingTop: 4 },
});
