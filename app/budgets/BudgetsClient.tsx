"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, RefreshCw, ArrowRight, Receipt, Edit2, Trash2, ShieldAlert } from "lucide-react";

type Category = {
    id: string;
    name: string;
};

type Budget = {
    id: string;
    categoryId: string;
    monthlyLimit: number;
    rollover: boolean;
    spent: number;
    available: number;
    totalLimit: number;
    category: Category;
};

function formatCurrency(amount: number) {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
    }).format(amount);
}

export default function BudgetsClient() {
    const [budgets, setBudgets] = useState<Budget[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Dialog state
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<string>("");
    const [monthlyLimit, setMonthlyLimit] = useState("");
    const [rollover, setRollover] = useState(false);
    const [saving, setSaving] = useState(false);
    const [dialogError, setDialogError] = useState<string | null>(null);

    // Delete dialog
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);

    const loadData = useCallback(async () => {
        try {
            const res = await fetch("/api/budgets");
            if (!res.ok) throw new Error("Failed to load budgets");
            const data = await res.json();
            if (data.ok) {
                setError(null);
                setBudgets(data.budgets || []);
                setCategories(data.categories || []);
            } else {
                throw new Error(data.error || "Failed to load budgets");
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        let mounted = true;
        const fetchBudgets = async () => {
            try {
                const res = await fetch("/api/budgets");
                if (!res.ok) throw new Error("Failed to load budgets");
                const data = await res.json();
                if (mounted && data.ok) {
                    setError(null);
                    setBudgets(data.budgets || []);
                    setCategories(data.categories || []);
                } else if (mounted) {
                    throw new Error(data.error || "Failed to load budgets");
                }
            } catch (err: unknown) {
                if (mounted) setError(err instanceof Error ? err.message : String(err));
            } finally {
                if (mounted) setLoading(false);
            }
        };
        void fetchBudgets();
        return () => {
            mounted = false;
        };
    }, []);

    const openNewBudgetDialog = () => {
        setEditingId(null);
        setSelectedCategory(categories[0]?.id || "");
        setMonthlyLimit("");
        setRollover(false);
        setDialogError(null);
        setIsDialogOpen(true);
    };

    const openEditBudgetDialog = (budget: Budget) => {
        setEditingId(budget.id);
        setSelectedCategory(budget.categoryId);
        setMonthlyLimit(budget.monthlyLimit.toString());
        setRollover(budget.rollover);
        setDialogError(null);
        setIsDialogOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        const limitNum = parseFloat(monthlyLimit);
        if (!selectedCategory || isNaN(limitNum) || limitNum <= 0) {
            setDialogError("Please select a category and enter a valid monthly limit.");
            return;
        }

        setSaving(true);
        setDialogError(null);
        try {
            const url = editingId ? `/api/budgets/${editingId}` : "/api/budgets";
            const method = editingId ? "PATCH" : "POST";
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    categoryId: selectedCategory,
                    monthlyLimit: limitNum,
                    rollover,
                }),
            });
            const data = await res.json();
            if (data.ok) {
                setIsDialogOpen(false);
                await loadData();
            } else {
                setDialogError(data.error || "Failed to save budget");
            }
        } catch (err: unknown) {
            setDialogError(err instanceof Error ? err.message : String(err));
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deletingId) return;
        setDeleting(true);
        try {
            const res = await fetch(`/api/budgets/${deletingId}`, { method: "DELETE" });
            const data = await res.json();
            if (data.ok) {
                setDeletingId(null);
                await loadData();
            } else {
                setError(data.error || "Failed to delete budget");
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Category Budgets</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Set and monitor monthly category budgets with automatic rollover tracking.
                    </p>
                </div>
                <button
                    onClick={openNewBudgetDialog}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-950/40 transition hover:from-emerald-400 hover:to-teal-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                >
                    <Plus size={18} />
                    <span>New Budget</span>
                </button>
            </div>

            {error && (
                <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-950/30 p-4 text-sm text-red-400">
                    <ShieldAlert size={18} className="shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {/* Loading state */}
            {loading ? (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-48 animate-pulse rounded-2xl border border-border/50 bg-card/40 p-6" />
                    ))}
                </div>
            ) : budgets.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-12 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <Receipt size={24} />
                    </div>
                    <h3 className="mt-4 text-lg font-semibold text-foreground">No Budgets Set</h3>
                    <p className="mt-1 text-sm text-muted-foreground">Create your first monthly category budget to start tracking spending!</p>
                    <button
                        onClick={openNewBudgetDialog}
                        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow transition hover:bg-primary/90"
                    >
                        <Plus size={16} />
                        <span>Create Budget</span>
                    </button>
                </div>
            ) : (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {budgets.map((b) => {
                        const progress = Math.min(1, b.spent / b.totalLimit);
                        const isWarning = progress > 0.8;
                        const isDanger = progress >= 1;
                        const progressBg = isDanger
                            ? "bg-red-500"
                            : isWarning
                            ? "bg-amber-400"
                            : "bg-emerald-400";
                        const categoryName = b.category?.name || "Unknown";

                        return (
                            <div
                                key={b.id}
                                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-b from-card/90 to-card/40 p-6 shadow-xl backdrop-blur-xl transition hover:border-border/100"
                            >
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-lg font-bold text-foreground">{categoryName}</h3>
                                            {b.rollover && (
                                                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
                                                    <RefreshCw size={10} />
                                                    Rollover
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1 opacity-80 transition group-hover:opacity-100">
                                            <button
                                                onClick={() => openEditBudgetDialog(b)}
                                                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                                                title="Edit Budget"
                                            >
                                                <Edit2 size={15} />
                                            </button>
                                            <button
                                                onClick={() => setDeletingId(b.id)}
                                                className="rounded-lg p-1.5 text-muted-foreground hover:bg-red-950/50 hover:text-red-400"
                                                title="Delete Budget"
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <span className="text-xs uppercase tracking-wider text-muted-foreground">Spent</span>
                                            <p className={`text-2xl font-extrabold ${isDanger ? "text-red-400" : isWarning ? "text-amber-300" : "text-emerald-400"}`}>
                                                {formatCurrency(b.spent)}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-xs uppercase tracking-wider text-muted-foreground">Limit</span>
                                            <p className="text-2xl font-extrabold text-foreground">{formatCurrency(b.totalLimit)}</p>
                                        </div>
                                    </div>

                                    {/* Progress track */}
                                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted/60">
                                        <div
                                            className={`h-full transition-all duration-500 ${progressBg}`}
                                            style={{ width: `${progress * 100}%` }}
                                        />
                                    </div>

                                    <p className="text-xs text-muted-foreground">
                                        Available{b.rollover ? " (inc. rollover)" : ""}:{" "}
                                        <span className="font-semibold text-foreground">{formatCurrency(b.available)}</span>
                                    </p>
                                </div>

                                {/* Redirect to Transactions Button */}
                                <div className="mt-6 pt-4 border-t border-border/40">
                                    <Link
                                        href={`/transactions?category=${encodeURIComponent(categoryName)}&dateRange=this_month`}
                                        className="inline-flex w-full items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-xs font-semibold text-emerald-400 transition hover:bg-emerald-500/20 hover:border-emerald-500/50"
                                    >
                                        <span className="inline-flex items-center gap-1.5">
                                            <Receipt size={14} />
                                            <span>View {categoryName} Transactions</span>
                                        </span>
                                        <ArrowRight size={14} />
                                    </Link>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Create/Edit Dialog */}
            {isDialogOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-6">
                        <h2 className="text-xl font-bold text-foreground">
                            {editingId ? "Edit Budget" : "New Category Budget"}
                        </h2>

                        {dialogError && (
                            <div className="rounded-lg bg-red-950/40 border border-red-500/30 p-3 text-xs text-red-400">
                                {dialogError}
                            </div>
                        )}

                        <form onSubmit={handleSave} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                                    Category
                                </label>
                                <select
                                    value={selectedCategory}
                                    onChange={(e) => setSelectedCategory(e.target.value)}
                                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                >
                                    {categories.map((cat) => (
                                        <option key={cat.id} value={cat.id}>
                                            {cat.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                                    Monthly Limit (₹)
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    step="any"
                                    placeholder="e.g. 15000"
                                    value={monthlyLimit}
                                    onChange={(e) => setMonthlyLimit(e.target.value)}
                                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                />
                            </div>

                            <div className="flex items-center justify-between pt-2">
                                <div>
                                    <label className="text-sm font-medium text-foreground">Enable Rollover</label>
                                    <p className="text-xs text-muted-foreground">Unspent funds roll over to next month</p>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={rollover}
                                    onChange={(e) => setRollover(e.target.checked)}
                                    className="h-5 w-5 rounded border-border text-primary focus:ring-primary"
                                />
                            </div>

                            <div className="flex items-center gap-3 pt-4 border-t border-border">
                                <button
                                    type="button"
                                    onClick={() => setIsDialogOpen(false)}
                                    className="flex-1 rounded-xl border border-border bg-muted/50 px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                                >
                                    {saving ? "Saving..." : editingId ? "Update" : "Create"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Dialog */}
            {deletingId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
                        <h3 className="text-lg font-bold text-foreground">Delete Budget?</h3>
                        <p className="text-sm text-muted-foreground">
                            Are you sure you want to delete this category budget? Existing transactions will remain unaffected.
                        </p>
                        <div className="flex items-center gap-3 pt-2">
                            <button
                                onClick={() => setDeletingId(null)}
                                className="flex-1 rounded-xl border border-border bg-muted/50 px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={deleting}
                                className="flex-1 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                            >
                                {deleting ? "Deleting..." : "Delete"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
