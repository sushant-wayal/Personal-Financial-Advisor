import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Animated,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  NativeScrollEvent,
  NativeSyntheticEvent,
  useWindowDimensions,
  View,
  BackHandler,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { GoalsSkeleton, Skeleton } from "../components/LoadingSkeleton";
import { formatCurrencyAmount, getCurrencySymbol, useCurrency } from "../providers/CurrencyProvider";
import { API_BASE_URL } from "../lib/apiBaseUrl";
import { beginHorizontalScroll, endHorizontalScroll, updateHorizontalScroll } from "../lib/horizontalScrollPriority";
import { clearClientCache, fetchCachedValue } from "../lib/clientCache";

function syncHorizontalScrollPriority(event: NativeSyntheticEvent<NativeScrollEvent>) {
  const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
  updateHorizontalScroll(contentOffset.x, layoutMeasurement.width, contentSize.width);
}

type GoalMilestone = {
  label: string;
  thresholdPct: number;
  achieved: boolean;
  amount: number;
  amountLabel: string;
};

type Goal = {
  id: string;
  title: string;
  status?: string | null;
  targetAmount: number;
  currentAmount: number;
  monthlyTarget?: number | null;
  priority: number;
  currency?: string | null;
  targetDate?: string | null;
  notes?: string | null;
  targetAmountLabel?: string;
  currentAmountLabel?: string;
  progressPct?: number;
  monthsLeft?: number | null;
  requiredMonthly?: number;
  requiredMonthlyLabel?: string;
  recommendedMonthlyContribution?: number;
  recommendedMonthlyContributionLabel?: string;
  eta?: { months?: number | null; eta?: string | null } | string | null;
  milestones?: GoalMilestone[];
  nextMilestone?: GoalMilestone | null;
  health?: string;
  confidenceScore?: number;
  recommendations?: string[];
};

type GoalConflict = {
  type: string;
  severity: "low" | "medium" | "high";
  message: string;
  affectedGoalIds?: string[];
};

type Overview = {
  goals: Goal[];
  conflicts: GoalConflict[];
  monthlyCapacity: number;
  monthlyCapacityLabel?: string;
  totalRecommendedMonthlyContribution: number;
  totalRecommendedMonthlyContributionLabel?: string;
};

type AdvisorRecommendation = {
  text: string;
  rationale?: string;
  priority?: "high" | "medium" | "low" | string;
};

type AdvisorPayload = {
  recommendations?: AdvisorRecommendation[];
  rationale?: string;
};

type ViewMode = "dashboard" | "all" | "detail";

function apiUrl(path: string) {
  return `${API_BASE_URL}${path}`;
}

async function fetchGoalsOverview(force = false): Promise<Overview> {
  return fetchCachedValue(
    "goals:overview",
    async () => {
      const res = await fetch(apiUrl("/api/goals/recommend"));
      if (!res.ok) throw new Error("Failed to load goals");
      const payload = await res.json();
      return {
        goals: payload.goals ?? [],
        conflicts: payload.conflicts ?? [],
        monthlyCapacity: payload.monthlyCapacity ?? 0,
        monthlyCapacityLabel: payload.monthlyCapacityLabel,
        totalRecommendedMonthlyContribution: payload.totalRecommendedMonthlyContribution ?? 0,
        totalRecommendedMonthlyContributionLabel: payload.totalRecommendedMonthlyContributionLabel,
      };
    },
    { force },
  );
}

async function fetchAIRecommendations(force = false): Promise<AdvisorPayload> {
  return fetchCachedValue(
    "goals:ai-recommendations",
    async () => {
      const res = await fetch(apiUrl(`/api/goals/ai${force ? "?force=true" : ""}`));
      const payload = await res.json();
      if (!res.ok || payload.ok === false) throw new Error(payload.error || "Failed to load AI recommendations");
      return payload as AdvisorPayload;
    },
    { force },
  );
}

async function fetchAIStatus(force = false): Promise<{ lastRun: string | null; recommendations: AdvisorPayload | null }> {
  return fetchCachedValue(
    "goals:ai-status",
    async () => {
      const res = await fetch(apiUrl("/api/goals/ai/status"));
      const payload = await res.json();
      if (!res.ok || payload.ok === false) throw new Error(payload.error || "Failed to load AI status");
      return {
        lastRun: payload.lastRun ?? null,
        recommendations: payload.recommendations ?? null,
      };
    },
    { force },
  );
}

async function createGoal(input: GoalFormState) {
  const res = await fetch(apiUrl("/api/goals"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: input.title.trim(),
      targetAmount: Number(input.targetAmount),
      targetDate: input.targetDate || undefined,
      priority: Number(input.priority || 3),
      notes: input.notes.trim() || undefined,
      initialAllocation: input.initialAllocation ? Number(input.initialAllocation) : undefined,
    }),
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok) throw new Error(payload?.error || "Failed to create goal");
  return payload.goal as Goal;
}

async function updateGoal(id: string, input: GoalFormState) {
  const res = await fetch(apiUrl(`/api/goals/${id}`), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: input.title.trim(),
      targetAmount: Number(input.targetAmount),
      targetDate: input.targetDate || null,
      priority: Number(input.priority || 3),
      notes: input.notes.trim() || null,
    }),
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok) throw new Error(payload?.error || "Failed to update goal");
  return payload.goal as Goal;
}

async function deleteGoal(id: string) {
  const res = await fetch(apiUrl(`/api/goals/${id}`), { method: "DELETE" });
  const payload = await res.json().catch(() => null);
  if (!res.ok) throw new Error(payload?.error || "Failed to delete goal");
  return payload.goal as Goal;
}

function formatCurrency(value?: number | null, currencyCode?: string) {
  return formatCurrencyAmount(Number(value ?? 0), currencyCode);
}

function formatDate(value?: string | null) {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
}

function toDateInput(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function toDateKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
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

function fullDateLabel(value?: string | null) {
  const date = parseDateKey(value);
  if (!date) return "Select date";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function buildCalendarDays(monthDate: Date) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const start = new Date(year, month, 1 - firstOfMonth.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
    return {
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

function etaLabel(goal: Goal) {
  if (goal.eta && typeof goal.eta === "object" && goal.eta.eta) return formatDate(goal.eta.eta);
  if (typeof goal.eta === "string") return formatDate(goal.eta);
  return formatDate(goal.targetDate);
}

function progressOf(goal: Goal) {
  if (typeof goal.progressPct === "number") return Math.max(0, Math.min(100, goal.progressPct));
  if (!goal.targetAmount) return 0;
  return Math.max(0, Math.min(100, (goal.currentAmount / goal.targetAmount) * 100));
}

function healthTone(goal: Goal) {
  const health = String(goal.health ?? "").toLowerCase();
  if (health.includes("risk") || health.includes("behind")) return "risk";
  if (health.includes("track")) return "track";
  return "ahead";
}

function healthLabel(goal: Goal) {
  const health = goal.health || "";
  if (health.toLowerCase().includes("risk")) return "At Risk";
  if (health.toLowerCase().includes("track")) return "On Track";
  if (health) return health.replace(/_/g, " ");
  return progressOf(goal) >= 50 ? "Ahead of Schedule" : "On Track";
}

function goalPriorityLabel(goal: Goal) {
  return `P${goal.priority ?? 3}`;
}

function blankForm(): GoalFormState {
  return { title: "", targetAmount: "", targetDate: "", priority: "3", notes: "", initialAllocation: "" };
}

function formFromGoal(goal: Goal): GoalFormState {
  return {
    title: goal.title,
    targetAmount: String(goal.targetAmount ?? ""),
    targetDate: toDateInput(goal.targetDate),
    priority: String(goal.priority ?? 3),
    notes: goal.notes ?? "",
    initialAllocation: "",
  };
}

type GoalFormState = {
  title: string;
  targetAmount: string;
  targetDate: string;
  priority: string;
  notes: string;
  initialAllocation: string;
};

export default function GoalsScreen() {
  useCurrency();
  const router = useRouter();
  const [view, setView] = useState<ViewMode>("dashboard");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [form, setForm] = useState<GoalFormState>(blankForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [advisorPayload, setAdvisorPayload] = useState<AdvisorPayload | null>(null);
  const [advisorRefreshing, setAdvisorRefreshing] = useState(false);
  const [advisorLastRun, setAdvisorLastRun] = useState<string | null>(null);
  const [advisorError, setAdvisorError] = useState<string | null>(null);

  const goals = useMemo(() => overview?.goals ?? [], [overview?.goals]);
  const selectedGoal = goals.find((goal) => goal.id === selectedGoalId) ?? goals[0] ?? null;

  const totals = useMemo(() => {
    const currentSaved = goals.reduce((sum, goal) => sum + Number(goal.currentAmount ?? 0), 0);
    const targetTotal = goals.reduce((sum, goal) => sum + Number(goal.targetAmount ?? 0), 0);
    const required = overview?.totalRecommendedMonthlyContribution ?? goals.reduce((sum, goal) => sum + Number(goal.requiredMonthly ?? 0), 0);
    return {
      currentSaved,
      targetTotal,
      gap: Math.max(0, targetTotal - currentSaved),
      required,
      fullyFunded: goals.filter((goal) => progressOf(goal) >= 100).length,
    };
  }, [goals, overview?.totalRecommendedMonthlyContribution]);

  const load = useCallback(async (force = false) => {
    setError(null);
    const data = await fetchGoalsOverview(force);
    setOverview(data);
    setSelectedGoalId((current) => current ?? data.goals[0]?.id ?? null);
    return data;
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        await load();
        if (!mounted) return;
        setError(null);
      } catch (e: unknown) {
        if (mounted) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    (async () => {
      try {
        const status = await fetchAIStatus();
        if (!mounted) return;
        const last = status.lastRun ? new Date(status.lastRun) : null;
        setAdvisorLastRun(last ? last.toISOString() : null);
        if (status.recommendations) {
          setAdvisorPayload(status.recommendations);
        }
        const ageMs = last ? Date.now() - last.getTime() : Number.POSITIVE_INFINITY;
        if (ageMs > 24 * 60 * 60 * 1000) {
          setAdvisorRefreshing(true);
          const data = await fetchAIRecommendations(true);
          if (!mounted) return;
          setAdvisorPayload(data);
          setAdvisorLastRun(new Date().toISOString());
        }
      } catch {
        // Match the web app: status errors should not block the goals screen.
      } finally {
        if (mounted) setAdvisorRefreshing(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Handle Android hardware back button while inside the Goals UI.
  // If a modal/sheet is open or the goals view is in 'all'/'detail',
  // intercept the back action and update local view state instead
  // of letting the router navigate away from the goals section.
  useEffect(() => {
    const onBackPress = () => {
      if (sheetVisible) {
        setSheetVisible(false);
        return true;
      }
      if (view === "detail") {
        setView("all");
        return true;
      }
      if (view === "all") {
        setView("dashboard");
        return true;
      }
      // allow default behavior (router or system) for other views
      return false;
    };

    const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => sub.remove();
  }, [view, sheetVisible]);

  async function refresh() {
    setRefreshing(true);
    try {
      clearClientCache();
      await load(true);
      const status = await fetchAIStatus(true);
      const last = status.lastRun ? new Date(status.lastRun) : null;
      setAdvisorLastRun(last ? last.toISOString() : null);
      if (status.recommendations) {
        setAdvisorPayload(status.recommendations);
      }
      setAdvisorRefreshing(true);
      try {
        const data = await fetchAIRecommendations(true);
        setAdvisorPayload(data);
        setAdvisorLastRun(new Date().toISOString());
      } catch (advisorError) {
        setAdvisorError(advisorError instanceof Error ? advisorError.message : String(advisorError));
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setAdvisorRefreshing(false);
      setRefreshing(false);
    }
  }

  function openCreateSheet() {
    setEditingGoal(null);
    setForm(blankForm());
    setFormError(null);
    setSheetVisible(true);
  }

  function openEditSheet(goal: Goal) {
    setEditingGoal(goal);
    setForm(formFromGoal(goal));
    setFormError(null);
    setSheetVisible(true);
  }

  async function saveGoal() {
    if (!form.title.trim()) {
      setFormError("Title is required.");
      return;
    }
    if (!Number.isFinite(Number(form.targetAmount)) || Number(form.targetAmount) <= 0) {
      setFormError("Enter a valid target amount.");
      return;
    }
    if (form.targetDate && compareDateKeys(form.targetDate, toDateKey(new Date())) < 0) {
      setFormError("Target date cannot be in the past.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const goal = editingGoal ? await updateGoal(editingGoal.id, form) : await createGoal(form);
      setSheetVisible(false);
      setEditingGoal(null);
      clearClientCache();
      await load(true);
      setSelectedGoalId(goal.id);
      if (!editingGoal) setView("detail");
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function removeGoal() {
    if (!editingGoal) return;
    setDeleting(true);
    setFormError(null);
    try {
      await deleteGoal(editingGoal.id);
      setSheetVisible(false);
      setEditingGoal(null);
      setSelectedGoalId(null);
      setView("all");
      clearClientCache();
      await load(true);
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : String(e));
    } finally {
      setDeleting(false);
    }
  }

  async function refreshAdvisorRecommendations() {
    setAdvisorRefreshing(true);
    setAdvisorError(null);
    try {
      const data = await fetchAIRecommendations(true);
      setAdvisorPayload(data);
      setAdvisorLastRun(new Date().toISOString());
    } catch (e: unknown) {
      setAdvisorError(e instanceof Error ? e.message : String(e));
    } finally {
      setAdvisorRefreshing(false);
    }
  }

  const renderContent = () => {
    if (loading) {
      return <GoalsSkeleton />;
    }
    if (error) {
      return (
        <View style={styles.centerState}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={() => void refresh()}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      );
    }
    if (view === "all") {
      return <AllGoalsView goals={goals} onBack={() => setView("dashboard")} onAdd={openCreateSheet} onSelect={(goal) => { setSelectedGoalId(goal.id); setView("detail"); }} />;
    }
    if (view === "detail" && selectedGoal) {
      return <GoalDetailView goal={selectedGoal} onBack={() => setView("all")} onEdit={() => openEditSheet(selectedGoal)} />;
    }
    return (
      <DashboardView
        goals={goals}
        overview={overview}
        advisorPayload={advisorPayload}
        advisorRefreshing={advisorRefreshing}
        advisorLastRun={advisorLastRun}
        advisorError={advisorError}
        totals={totals}
        onViewAll={() => setView("all")}
        onAdd={openCreateSheet}
        onRefreshAdvisor={() => void refreshAdvisorRecommendations()}
        onSelect={(goal) => { setSelectedGoalId(goal.id); setView("detail"); }}
      />
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor="#131313" />
      {view === "dashboard" ? <DashboardHeader onSimulate={() => router.push("/simulation")} /> : null}
      {(view === "all" || view === "detail") && !loading && !error ? (
        renderContent()
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, view !== "dashboard" ? styles.scrollContentSecondary : null]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor="#ffffff" />}
          showsVerticalScrollIndicator={false}
        >
          {renderContent()}
        </ScrollView>
      )}
      <GoalSheet
        visible={sheetVisible}
        editing={editingGoal}
        form={form}
        error={formError}
        saving={saving}
        deleting={deleting}
        onChange={setForm}
        onClose={() => setSheetVisible(false)}
        onSave={() => void saveGoal()}
        onDelete={() => void removeGoal()}
      />
    </SafeAreaView>
  );
}

function DashboardHeader({ onSimulate }: { onSimulate: () => void }) {
  return (
    <View style={styles.topBar}>
      <View style={styles.topBarTitleWrap}>
        <MaterialIcons name="track-changes" size={24} color="#ffffff" />
        <Text style={styles.topBarTitle}>Goals</Text>
      </View>
      <Pressable style={styles.simulateButton} onPress={onSimulate}>
        <Text style={styles.simulateText}>SIMULATE</Text>
      </Pressable>
    </View>
  );
}

function DashboardView({
  goals,
  overview,
  advisorPayload,
  advisorRefreshing,
  advisorLastRun,
  advisorError,
  totals,
  onViewAll,
  onAdd,
  onRefreshAdvisor,
  onSelect,
}: {
  goals: Goal[];
  overview: Overview | null;
  advisorPayload: AdvisorPayload | null;
  advisorRefreshing: boolean;
  advisorLastRun: string | null;
  advisorError: string | null;
  totals: { currentSaved: number; gap: number; required: number; fullyFunded: number };
  onViewAll: () => void;
  onAdd: () => void;
  onRefreshAdvisor: () => void;
  onSelect: (goal: Goal) => void;
}) {
  const { width } = useWindowDimensions();
  const carouselCardWidth = Math.max(244, width - 92);
  const carouselSnap = carouselCardWidth + 14;
  const [conflictScrollX] = useState(() => new Animated.Value(0));
  const [advisorScrollX] = useState(() => new Animated.Value(0));
  const advisorRecommendations = advisorPayload?.recommendations ?? [];
  const conflicts = overview?.conflicts?.length ? overview.conflicts : [{ type: "budget", severity: "low", message: "No active conflicts. Goals are currently balanced." } as GoalConflict];
  const advisorCards = advisorRecommendations.length
    ? advisorRecommendations
    : [{ text: advisorError || "No advisor recommendations yet. Refresh to generate the latest guidance.", priority: "low", rationale: advisorError ? undefined : "Run advisor for personalized recommendations" }];

  return (
    <View style={styles.dashboardCanvas}>
      <View style={styles.heroBlock}>
        <View style={styles.heroHeader}>
          <Text style={styles.eyebrow}>Goals Dashboard</Text>
          <Text style={styles.heroTitle}>Funding Overview</Text>
          <View style={styles.fundingGapRow}>
            <Text style={styles.gapLabel}>Funding Gap</Text>
            <Text style={styles.gapValue}>{formatCurrency(totals.gap)}</Text>
            <Text style={styles.gapMeta}>Across {goals.length} goals</Text>
          </View>
        </View>
        <View style={styles.statsGrid}>
          <StatCard label="Goals Tracked" value={String(goals.length)} note={`${totals.fullyFunded} fully funded`} icon="add" onIconPress={onAdd} />
          <StatCard label="Current Saved" value={formatCurrency(totals.currentSaved)} note={`Gap remaining ${formatCurrency(totals.gap)}`} />
          <StatCard label="Monthly Capacity" value={overview?.monthlyCapacityLabel ?? formatCurrency(overview?.monthlyCapacity ?? 0)} note={`${overview?.conflicts?.length ?? 0} conflicts flagged`} tone="danger" />
          <StatCard label="Required Monthly" value={overview?.totalRecommendedMonthlyContributionLabel ?? formatCurrency(totals.required)} note="Planned commitments" />
        </View>
      </View>

      <View style={styles.timelineCard}>
        <View style={styles.cardHeadingRow}>
          <View style={styles.cardHeadingCopy}>
            <Text style={styles.sectionTitle}>Gantt Timeline</Text>
            <Text style={styles.sectionSubtext}>Visual timeline of all goals and their progress</Text>
          </View>
          <Pressable style={styles.viewAllButton} onPress={onViewAll}>
            <Text style={styles.viewAllText}>VIEW ALL</Text>
            <MaterialIcons name="chevron-right" size={18} color="#ffffff" />
          </Pressable>
        </View>
        <View style={styles.timelineTable}>
          <View style={styles.timelineHeaderRow}>
            <Text style={[styles.timelineHeaderText, styles.timelineGoalCell]}>Goal</Text>
            <Text style={styles.timelineHeaderText}>May 26</Text>
            <Text style={styles.timelineHeaderText}>Jul 26</Text>
            <Text style={styles.timelineHeaderText}>Aug 26</Text>
          </View>
          {goals.slice(0, 4).map((goal) => (
            <Pressable key={goal.id} style={styles.timelineRow} onPress={() => onSelect(goal)}>
              <View style={styles.timelineGoalNameCell}>
                <Text style={styles.timelineGoalName}>{goal.title}</Text>
                <Text style={styles.timelineGoalPriority}>{goalPriorityLabel(goal)}</Text>
              </View>
              <View style={styles.timelineBarArea}>
                <View style={[styles.timelineBar, toneStyle(goal).barSoft, { width: `${Math.max(12, Math.min(88, progressOf(goal)))}%`, marginLeft: `${Math.min(28, goal.priority * 6)}%` }]} />
                {healthTone(goal) === "risk" ? <View style={styles.timelineMarker} /> : null}
              </View>
            </Pressable>
          ))}
        </View>
        <View style={styles.legendRow}>
          <LegendDot color="#05e777" label="Ahead of Schedule" />
          <LegendDot color="#005ed6" label="On Track" />
          <LegendDot color="#ffb4ab" label="At Risk" />
        </View>
      </View>

      <View style={styles.panelCard}>
        <View style={styles.cardHeadingRow}>
          <View style={styles.cardHeadingCopy}>
            <Text style={styles.sectionTitle}>Goal conflicts</Text>
            <Text style={styles.sectionSubtext}>Monthly capacity: {overview?.monthlyCapacityLabel ?? formatCurrency(0)} • Required: {overview?.totalRecommendedMonthlyContributionLabel ?? formatCurrency(0)}</Text>
          </View>
          <Text style={styles.attentionPill}>Needs Attention</Text>
        </View>
        <Animated.ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carouselContent}
          decelerationRate="fast"
          snapToInterval={carouselSnap}
          snapToAlignment="start"
          onTouchStart={beginHorizontalScroll}
          onTouchEnd={endHorizontalScroll}
          onTouchCancel={endHorizontalScroll}
          onScrollBeginDrag={beginHorizontalScroll}
          onScrollEndDrag={endHorizontalScroll}
          onMomentumScrollEnd={endHorizontalScroll}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: conflictScrollX } } }], { useNativeDriver: false, listener: syncHorizontalScrollPriority })}
          scrollEventThrottle={16}
        >
          {conflicts.map((conflict, index) => (
            <View key={`${conflict.type}-${index}`} style={[styles.conflictCard, { width: carouselCardWidth }]}>
              <View style={styles.conflictHeader}>
                <Text style={styles.conflictTitle}>{conflict.type.replace(/_/g, " ")} Conflict</Text>
                <Text style={styles.conflictSeverity}>{conflict.severity}</Text>
              </View>
              <Text style={styles.conflictBody}>{conflict.message}</Text>
            </View>
          ))}
        </Animated.ScrollView>
        <CarouselDots scrollX={conflictScrollX} count={conflicts.length} itemWidth={carouselSnap} />
      </View>

      <View style={styles.panelCard}>
        <View style={styles.advisorHeading}>
          <View style={styles.advisorTitleWrap}>
            <MaterialIcons name="psychology" size={22} color="#b0c6ff" />
            <View style={styles.cardHeadingCopy}>
              <Text style={styles.sectionTitle}>AI Financial Advisor</Text>
              <Text style={styles.sectionSubtext}>{advisorPayload?.rationale ?? "Run advisor for personalized recommendations"}</Text>
              {advisorLastRun ? <Text style={styles.advisorLastRun}>Last run: {formatAdvisorRun(advisorLastRun)}</Text> : null}
            </View>
          </View>
          <Pressable style={({ pressed }) => [styles.advisorRefreshButton, pressed ? styles.cardPressed : null, advisorRefreshing ? styles.advisorRefreshButtonActive : null]} onPress={onRefreshAdvisor} disabled={advisorRefreshing}>
            {advisorRefreshing ? <Skeleton width={18} height={18} radius={9} /> : <MaterialIcons name="refresh" size={18} color="#ffffff" />}
          </Pressable>
        </View>
        <Animated.ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carouselContent}
          decelerationRate="fast"
          snapToInterval={carouselSnap}
          snapToAlignment="start"
          onTouchStart={beginHorizontalScroll}
          onTouchEnd={endHorizontalScroll}
          onTouchCancel={endHorizontalScroll}
          onScrollBeginDrag={beginHorizontalScroll}
          onScrollEndDrag={endHorizontalScroll}
          onMomentumScrollEnd={endHorizontalScroll}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: advisorScrollX } } }], { useNativeDriver: false, listener: syncHorizontalScrollPriority })}
          scrollEventThrottle={16}
        >
          {advisorCards.map((item, index) => (
            <View key={`${item.text}-${index}`} style={[styles.adviceCard, { width: carouselCardWidth }]}>
              <View style={[styles.adviceAccent, priorityStyle(item.priority)]} />
              <Text style={styles.adviceTitle}>{advisorError && !advisorRecommendations.length ? "Advisor unavailable" : priorityLabel(item.priority)}</Text>
              <Text style={styles.adviceBody}>{item.text}</Text>
              {item.rationale ? <Text style={styles.adviceRationale}>{item.rationale}</Text> : null}
            </View>
          ))}
        </Animated.ScrollView>
        <CarouselDots scrollX={advisorScrollX} count={advisorCards.length} itemWidth={carouselSnap} />
      </View>
    </View>
  );
}

function CarouselDots({ scrollX, count, itemWidth }: { scrollX: Animated.Value; count: number; itemWidth: number }) {
  return (
    <View style={styles.paginationRow}>
      {Array.from({ length: count }, (_, index) => {
        const inputRange = [(index - 1) * itemWidth, index * itemWidth, (index + 1) * itemWidth];
        return (
          <Animated.View
            key={`goal-carousel-dot-${count}-${index}`}
            style={[
              styles.paginationDot,
              {
                width: scrollX.interpolate({ inputRange, outputRange: [6, 18, 6], extrapolate: "clamp" }),
                opacity: scrollX.interpolate({ inputRange, outputRange: [0.28, 1, 0.28], extrapolate: "clamp" }),
                backgroundColor: scrollX.interpolate({
                  inputRange,
                  outputRange: ["rgba(255,255,255,0.22)", "#7dffa2", "rgba(255,255,255,0.22)"],
                  extrapolate: "clamp",
                }),
              },
            ]}
          />
        );
      })}
    </View>
  );
}

function AllGoalsView({ goals, onBack, onAdd, onSelect }: { goals: Goal[]; onBack: () => void; onAdd: () => void; onSelect: (goal: Goal) => void }) {
  return (
    <View style={styles.allCanvas}>
      <Pressable style={styles.backLink} onPress={onBack}>
        <MaterialIcons name="chevron-left" size={18} color="#c4c7c8" />
        <Text style={styles.backLinkText}>Back to Dashboard</Text>
      </Pressable>
      <View style={styles.allHeader}>
        <View>
          <Text style={styles.eyebrow}>Overview</Text>
          <Text style={styles.allTitle}>Wealth Goals</Text>
        </View>
        <Pressable style={styles.smallAddButton} onPress={onAdd}>
          <MaterialIcons name="add" size={20} color="#7dffa2" />
        </Pressable>
      </View>
      <ScrollView style={styles.goalListScroll} contentContainerStyle={styles.goalList} showsVerticalScrollIndicator={false}>
        {goals.map((goal) => <GoalCard key={goal.id} goal={goal} onPress={() => onSelect(goal)} />)}
        {!goals.length ? (
          <View style={styles.emptyGoals}>
            <Text style={styles.emptyTitle}>No goals yet</Text>
            <Text style={styles.sectionSubtext}>Create your first financial goal to start tracking progress.</Text>
            <Pressable style={styles.fullPrimaryButton} onPress={onAdd}>
              <Text style={styles.fullPrimaryButtonText}>Create Goal</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function GoalDetailView({ goal, onBack, onEdit }: { goal: Goal; onBack: () => void; onEdit: () => void }) {
  const milestones = goal.milestones?.length ? goal.milestones : [25, 50, 75, 100].map((pct) => ({
    label: `${pct}% milestone`,
    thresholdPct: pct,
    achieved: progressOf(goal) >= pct,
    amount: Math.round(goal.targetAmount * pct / 100),
    amountLabel: formatCurrency(goal.targetAmount * pct / 100),
  }));

  return (
    <View style={styles.detailCanvas}>
      <View style={styles.detailHeader}>
        <Pressable style={styles.detailBackButton} onPress={onBack}>
          <MaterialIcons name="arrow-back" size={24} color="#c4c7c8" />
        </Pressable>
        <Text style={styles.detailTopTitle}>{goal.title}</Text>
      </View>
      <ScrollView style={styles.detailScroll} contentContainerStyle={styles.detailContent} showsVerticalScrollIndicator={false}>
        <View style={styles.detailMainCard}>
          <View style={styles.detailCardHeader}>
            <View style={styles.detailTitleBlock}>
              <Text style={styles.detailGoalTitle}>{goal.title}</Text>
              <Text style={styles.detailMeta}>Target: {goal.targetAmountLabel ?? formatCurrency(goal.targetAmount)} <Text style={styles.pipe}>|</Text> Current: {goal.currentAmountLabel ?? formatCurrency(goal.currentAmount)}</Text>
            </View>
            <View style={styles.detailHealthBlock}>
              <Text style={styles.healthLabel}>Health</Text>
              <Text style={[styles.healthValue, toneStyle(goal).text]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.76}>{healthLabel(goal)}</Text>
              <Text style={styles.confidenceText}>Confidence: {Math.round(goal.confidenceScore ?? progressOf(goal))}%</Text>
            </View>
          </View>
          <View style={styles.detailMetaRow}>
            <Text style={styles.detailMetaSmall}>Required / month: <Text style={styles.detailMetaStrong}>{goal.requiredMonthlyLabel ?? formatCurrency(goal.requiredMonthly)}</Text></Text>
            <Text style={styles.detailMetaSmall}>ETA: <Text style={styles.detailMetaStrong}>{etaLabel(goal)}</Text></Text>
          </View>
          <View style={styles.detailProgressTrack}>
            <View style={[styles.detailProgressFill, toneStyle(goal).fill, { width: `${progressOf(goal)}%` }]} />
          </View>
          <Pressable style={styles.editGoalButton} onPress={onEdit}>
            <MaterialIcons name="edit" size={18} color="#ffffff" />
            <Text style={styles.editGoalButtonText}>EDIT GOAL</Text>
          </Pressable>
        </View>

        <View style={styles.detailSection}>
          <Text style={styles.sectionTitle}>Milestones</Text>
          <Text style={styles.sectionSubtext}>Derived progress checkpoints for this goal</Text>
          <Text style={styles.recommendedLine}>Recommended monthly: {goal.recommendedMonthlyContributionLabel ?? goal.requiredMonthlyLabel ?? formatCurrency(goal.requiredMonthly)}</Text>
          <View style={styles.milestoneGrid}>
            {milestones.map((milestone) => (
              <View key={milestone.thresholdPct} style={[styles.milestoneCard, milestone.achieved ? styles.milestoneCardDone : null]}>
                <View style={milestone.achieved ? styles.milestoneAccent : null} />
                <Text style={[styles.milestoneLabel, milestone.achieved ? styles.milestoneLabelDone : null]}>{milestone.label}</Text>
                <Text style={styles.milestoneAmount}>{milestone.amountLabel}</Text>
                <Text style={styles.milestoneStatus}>{milestone.achieved ? "Achieved" : "Pending"}</Text>
              </View>
            ))}
          </View>
          <View style={styles.nextMilestoneBox}>
            <Text style={styles.sectionSubtext}>
              Next milestone: {goal.nextMilestone ? `${goal.nextMilestone.label} at ${goal.nextMilestone.amountLabel}` : "Goal completed"}
            </Text>
          </View>
        </View>

        <View style={styles.recommendationCard}>
          <View style={styles.recommendationHeader}>
            <MaterialIcons name="auto-awesome" size={22} color="#b0c6ff" />
            <Text style={styles.recommendationTitle}>Recommendations</Text>
          </View>

          {(goal.recommendations?.length
            ? goal.recommendations
            : ["You are on pace — consider allocating surplus to accelerate this goal."]
          ).map((item, index) => (
            <View key={`${item}-${index}`} style={styles.recommendationRow}>
              <View style={styles.recommendationDot} />
              <Text style={styles.recommendationText}>{item}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function GoalCard({ goal, onPress }: { goal: Goal; onPress: () => void }) {
  const tone = toneStyle(goal);
  return (
    <Pressable style={({ pressed }) => [styles.goalCard, pressed ? styles.cardPressed : null]} onPress={onPress}>
      <View style={[styles.goalGlow, tone.glow]} />
      <View style={styles.goalCardHeader}>
        <Text style={styles.goalCardTitle}>{goal.title}</Text>
        <View style={styles.goalHealth}>
          <Text style={styles.healthLabel}>Health</Text>
          <Text style={[styles.goalHealthText, tone.text]}>{healthLabel(goal)}</Text>
          <Text style={styles.confidenceText}>Confidence: <Text style={styles.confidenceStrong}>{Math.round(goal.confidenceScore ?? progressOf(goal))}%</Text></Text>
        </View>
      </View>
      <View style={styles.goalFactsGrid}>
        <GoalFact label="Target:" value={goal.targetAmountLabel ?? formatCurrency(goal.targetAmount)} />
        <GoalFact label="Current:" value={goal.currentAmountLabel ?? formatCurrency(goal.currentAmount)} />
        <GoalFact label="Required / month:" value={goal.requiredMonthlyLabel ?? formatCurrency(goal.requiredMonthly)} />
        <GoalFact label="ETA:" value={etaLabel(goal)} />
      </View>
      <View style={styles.goalProgressTrack}>
        <View style={[styles.goalProgressFill, tone.fill, { width: `${progressOf(goal)}%` }]} />
      </View>
      <View style={styles.goalCardFooter}>
        <Text style={styles.goalFooterText}>Click to view details</Text>
        <MaterialIcons name="arrow-forward" size={16} color="#c4c7c8" />
      </View>
    </Pressable>
  );
}

function GoalSheet({
  visible,
  editing,
  form,
  error,
  saving,
  deleting,
  onChange,
  onClose,
  onSave,
  onDelete,
}: {
  visible: boolean;
  editing: Goal | null;
  form: GoalFormState;
  error: string | null;
  saving: boolean;
  deleting: boolean;
  onChange: (form: GoalFormState) => void;
  onClose: () => void;
  onSave: () => void;
  onDelete: () => void;
}) {
  const update = (patch: Partial<GoalFormState>) => onChange({ ...form, ...patch });
  const selectedTargetDate = parseDateKey(form.targetDate);
  const todayKey = toDateKey(new Date());
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [dateDraft, setDateDraft] = useState(form.targetDate && compareDateKeys(form.targetDate, todayKey) >= 0 ? form.targetDate : todayKey);
  const [dateMonth, setDateMonth] = useState(() => {
    const date = selectedTargetDate && compareDateKeys(toDateKey(selectedTargetDate), todayKey) >= 0 ? selectedTargetDate : new Date();
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });
  const calendarDays = useMemo(() => buildCalendarDays(dateMonth), [dateMonth]);
  const currencySymbol = getCurrencySymbol();

  function openDatePicker() {
    const parsed = parseDateKey(form.targetDate);
    const nextDate = parsed && compareDateKeys(toDateKey(parsed), todayKey) >= 0 ? parsed : new Date();
    setDateDraft(toDateKey(nextDate));
    setDateMonth(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));
    setDatePickerVisible(true);
  }

  function applyTargetDate() {
    update({ targetDate: compareDateKeys(dateDraft, todayKey) < 0 ? todayKey : dateDraft });
    setDatePickerVisible(false);
  }

  return (
    <>
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <SafeAreaView style={styles.sheetBackdrop} edges={["bottom"]}>
          <View style={styles.goalSheet}>
            <View style={styles.grabHandle} />
            <View style={styles.goalSheetHeader}>
              <Text style={styles.goalSheetTitle}>{editing ? "Edit Goal" : "New Financial Goal"}</Text>
              <Pressable onPress={onClose} style={styles.sheetIconButton}>
                <MaterialIcons name="close" size={24} color="#c4c7c8" />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.goalSheetBody} showsVerticalScrollIndicator={false}>
              <GoalInput label="Title" value={form.title} placeholder="e.g., Retirement Fund" icon="track-changes" onChangeText={(title) => update({ title })} />
              <GoalInput label="Target Amount" value={form.targetAmount} placeholder="0.00" keyboardType="numeric" prefix={currencySymbol} onChangeText={(targetAmount) => update({ targetAmount: targetAmount.replace(/[^0-9.]/g, "") })} />
              {!editing ? <GoalInput label="Initial Allocation" value={form.initialAllocation} placeholder="0.00" keyboardType="numeric" prefix={currencySymbol} onChangeText={(initialAllocation) => update({ initialAllocation: initialAllocation.replace(/[^0-9.]/g, "") })} /> : null}
              <GoalDateField value={form.targetDate} onPress={openDatePicker} />
              <GoalInput label="Priority" value={form.priority} placeholder="1-5" keyboardType="numeric" icon="flag" onChangeText={(priority) => update({ priority: priority.replace(/[^0-9]/g, "").slice(0, 1) })} />
              <GoalInput label="Notes" value={form.notes} placeholder="Add optional details..." icon="notes" multiline onChangeText={(notes) => update({ notes })} />
              {editing ? (
                <View style={styles.systemNote}>
                  <MaterialIcons name="info" size={20} color="#8e9192" />
                  <Text style={styles.systemNoteText}>Current amount is derived automatically from balance, savings capacity, allocation, and savings behavior.</Text>
                </View>
              ) : null}
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
            </ScrollView>
            <View style={styles.goalSheetFooter}>
              {editing ? (
                <Pressable style={styles.sheetDeleteButton} disabled={deleting || saving} onPress={onDelete}>
                  {deleting ? <Skeleton width={22} height={22} radius={11} /> : <MaterialIcons name="delete" size={22} color="#ffb4ab" />}
                </Pressable>
              ) : null}
              <Pressable style={styles.sheetCancelButton} onPress={onClose}>
                <Text style={styles.sheetCancelText}>CANCEL</Text>
              </Pressable>
              <Pressable style={styles.sheetPrimaryButton} disabled={saving || deleting} onPress={onSave}>
                {saving ? <Skeleton width={92} height={16} radius={8} /> : <Text style={styles.sheetPrimaryText}>{editing ? "SAVE" : "CREATE GOAL"}</Text>}
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      <Modal visible={datePickerVisible} transparent animationType="fade" onRequestClose={() => setDatePickerVisible(false)}>
        <SafeAreaView style={styles.goalDateOverlay} edges={["top", "bottom"]}>
          <View style={styles.goalDateCard}>
            <View style={styles.goalDateHeader}>
              <Text style={styles.goalDateTitle}>Select Target Date</Text>
              <Pressable onPress={() => setDatePickerVisible(false)} style={styles.sheetIconButton}>
                <MaterialIcons name="close" size={24} color="#c4c7c8" />
              </Pressable>
            </View>
            <View style={styles.goalDateContent}>
              <View style={styles.dateSummaryCard}>
                <View>
                  <Text style={styles.dateSummaryLabel}>TARGET DATE</Text>
                  <Text style={styles.dateSummaryValue}>{fullDateLabel(dateDraft)}</Text>
                </View>
                <MaterialIcons name="event" size={24} color="#7dffa2" />
              </View>
              <View style={styles.addCalendarHeader}>
                <Pressable onPress={() => setDateMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}>
                  <MaterialIcons name="chevron-left" size={26} color="#c4c7c8" />
                </Pressable>
                <Text style={styles.addCalendarMonth}>{monthTitle(dateMonth)}</Text>
                <Pressable onPress={() => setDateMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}>
                  <MaterialIcons name="chevron-right" size={26} color="#c4c7c8" />
                </Pressable>
              </View>
              <View style={styles.addWeekdayGrid}>
                {["SU", "MO", "TU", "WE", "TH", "FR", "SA"].map((day) => <Text key={day} style={styles.addWeekdayText}>{day}</Text>)}
              </View>
              <View style={styles.addDateGrid}>
                {calendarDays.map((day) => {
                  const selected = day.key === dateDraft;
                  const disabled = compareDateKeys(day.key, todayKey) < 0;
                  return (
                    <Pressable key={day.key} disabled={disabled} onPress={() => setDateDraft(day.key)} style={[styles.addDateCell, selected ? styles.addDateCellSelected : null, disabled ? styles.addDateCellDisabled : null]}>
                      <Text style={[styles.addDateCellText, !day.inMonth || disabled ? styles.dateTextMuted : null, selected ? styles.addDateCellTextSelected : null]}>{day.day}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <View style={styles.goalDateFooter}>
              <Pressable style={styles.sheetCancelButton} onPress={() => setDatePickerVisible(false)}>
                <Text style={styles.sheetCancelText}>CANCEL</Text>
              </Pressable>
              <Pressable style={styles.sheetPrimaryButton} onPress={applyTargetDate}>
                <Text style={styles.sheetPrimaryText}>SET DATE</Text>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
}

function GoalDateField({ value, onPress }: { value: string; onPress: () => void }) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>Target Date</Text>
      <Pressable style={styles.inputWrap} onPress={onPress}>
        <MaterialIcons name="calendar-today" size={20} color="#8e9192" style={styles.inputIcon} />
        <Text style={[styles.goalDateValue, !value ? styles.goalDatePlaceholder : null]}>{value ? fullDateLabel(value) : "Select target date"}</Text>
        <MaterialIcons name="chevron-right" size={22} color="#8e9192" style={styles.inputChevron} />
      </Pressable>
    </View>
  );
}

function GoalInput({
  label,
  value,
  placeholder,
  onChangeText,
  prefix,
  icon,
  multiline,
  keyboardType,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChangeText: (value: string) => void;
  prefix?: string;
  icon?: React.ComponentProps<typeof MaterialIcons>["name"];
  multiline?: boolean;
  keyboardType?: "default" | "numeric";
}) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={styles.inputWrap}>
        {prefix ? <Text style={styles.inputPrefix}>{prefix}</Text> : null}
        {!prefix && icon ? <MaterialIcons name={icon} size={20} color="#8e9192" style={styles.inputIcon} /> : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="rgba(196,199,200,0.42)"
          multiline={multiline}
          keyboardType={keyboardType}
          textAlignVertical={multiline ? "top" : "center"}
          style={[styles.goalInput, prefix || icon ? styles.goalInputPrefixed : null, multiline ? styles.goalTextArea : null]}
        />
      </View>
    </View>
  );
}

function StatCard({ label, value, note, tone, icon, onIconPress }: { label: string; value: string; note: string; tone?: "danger"; icon?: string; onIconPress?: () => void }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      {icon ? (
        <Pressable style={styles.statIconButton} onPress={onIconPress}>
          <MaterialIcons name={icon as React.ComponentProps<typeof MaterialIcons>["name"]} size={16} color="#ffffff" />
        </Pressable>
      ) : null}
      <Text style={styles.statValue}>{value}</Text>
      <Text style={[styles.statNote, tone === "danger" ? styles.dangerText : null]}>{note}</Text>
    </View>
  );
}

function GoalFact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.goalFactCell}>
      <Text style={styles.goalFactLabel}>{label}</Text>
      <Text style={styles.goalFactValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78}>
        {value}
      </Text>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

function toneStyle(goal: Goal) {
  const tone = healthTone(goal);
  if (tone === "risk") {
    return {
      text: styles.toneRiskText,
      fill: styles.toneRiskFill,
      glow: styles.toneRiskGlow,
      barSoft: styles.toneRiskBarSoft,
      accent: styles.toneRiskAccent,
    };
  }
  if (tone === "track") {
    return {
      text: styles.toneTrackText,
      fill: styles.toneTrackFill,
      glow: styles.toneTrackGlow,
      barSoft: styles.toneTrackBarSoft,
      accent: styles.toneTrackAccent,
    };
  }
  return {
    text: styles.toneAheadText,
    fill: styles.toneAheadFill,
    glow: styles.toneAheadGlow,
    barSoft: styles.toneAheadBarSoft,
    accent: styles.toneAheadAccent,
  };
}

function priorityLabel(priority?: string) {
  if (!priority) return "AI Recommendation";
  if (priority === "cover_deficit") return "Funding Gap";
  if (priority === "ok") return "On Pace";
  return `${priority.charAt(0).toUpperCase()}${priority.slice(1)} Priority`;
}

function priorityStyle(priority?: string) {
  if (priority === "high" || priority === "cover_deficit") return styles.toneRiskAccent;
  if (priority === "medium") return styles.toneTrackAccent;
  return styles.toneAheadAccent;
}

function formatAdvisorRun(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

const fs = (size: number) => Math.round(size * 0.9 * 10) / 10;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#131313" },
  scroll: { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 132, gap: 48 },
  scrollContentSecondary: { paddingTop: 24, gap: 24 },
  topBar: {
    height: 96,
    paddingTop: 14,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(68,71,72,0.20)",
    backgroundColor: "rgba(19,19,19,0.94)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topBarTitleWrap: { flexDirection: "row", alignItems: "center", gap: 8 },
  topBarTitle: { color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: fs(20), fontWeight: "700" },
  simulateButton: { borderRadius: 999, backgroundColor: "#ffffff", paddingHorizontal: 20, paddingVertical: 9 },
  simulateText: { color: "#131313", fontFamily: "JetBrains Mono", fontSize: fs(12), fontWeight: "700" },
  dashboardCanvas: { gap: 48 },
  heroBlock: { gap: 32 },
  heroHeader: { borderBottomWidth: 1, borderBottomColor: "rgba(68,71,72,0.20)", paddingBottom: 32 },
  eyebrow: { color: "#c4c7c8", fontFamily: "JetBrains Mono", fontSize: fs(11), letterSpacing: 1.8, textTransform: "uppercase", fontWeight: "700", marginBottom: 12 },
  heroTitle: { color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: fs(32), lineHeight: 40, fontWeight: "700" },
  fundingGapRow: { marginTop: 16, flexDirection: "row", alignItems: "baseline", gap: 10, flexWrap: "wrap" },
  gapLabel: { color: "#c4c7c8", fontFamily: "JetBrains Mono", fontSize: fs(10), letterSpacing: 1.2, textTransform: "uppercase" },
  gapValue: { color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: fs(28), lineHeight: 34, fontWeight: "600" },
  gapMeta: { color: "#c4c7c8", fontFamily: "Inter", fontSize: fs(12) },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  statCard: { width: "48%", minHeight: 138, borderRadius: 16, borderWidth: 1, borderColor: "rgba(68,71,72,0.35)", backgroundColor: "#0e0e0e", padding: 18, gap: 8 },
  statLabel: { color: "#c4c7c8", fontFamily: "JetBrains Mono", fontSize: fs(10), letterSpacing: 1.5, textTransform: "uppercase", paddingRight: 34 },
  statIconButton: { position: "absolute", top: 12, right: 12, width: 28, height: 28, borderRadius: 14, backgroundColor: "#2a2a2a", alignItems: "center", justifyContent: "center" },
  statValue: { color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: fs(28), lineHeight: 34, fontWeight: "600" },
  statNote: { color: "#c4c7c8", fontFamily: "Inter", fontSize: fs(13), lineHeight: 18 },
  dangerText: { color: "#ffb4ab" },
  timelineCard: { borderRadius: 16, borderWidth: 1, borderColor: "rgba(68,71,72,0.35)", backgroundColor: "#0e0e0e", padding: 22 },
  panelCard: { borderRadius: 16, borderWidth: 1, borderColor: "rgba(68,71,72,0.35)", backgroundColor: "#0e0e0e", padding: 22 },
  cardHeadingRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 24 },
  cardHeadingCopy: { flex: 1, minWidth: 0, paddingRight: 4 },
  sectionTitle: { color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: fs(20), lineHeight: 28, fontWeight: "600" },
  sectionSubtext: { color: "#c4c7c8", fontFamily: "Inter", fontSize: fs(14), lineHeight: 20, marginTop: 2 },
  viewAllButton: { flexShrink: 0, minHeight: 34, borderRadius: 999, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", backgroundColor: "rgba(255,255,255,0.06)", paddingLeft: 12, paddingRight: 7, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 1 },
  viewAllText: { color: "#ffffff", fontFamily: "JetBrains Mono", fontSize: fs(10), letterSpacing: 0.8, fontWeight: "700" },
  timelineTable: { borderWidth: 1, borderColor: "rgba(68,71,72,0.35)", borderRadius: 12, overflow: "hidden" },
  timelineHeaderRow: { height: 48, flexDirection: "row", backgroundColor: "rgba(19,19,19,0.55)" },
  timelineHeaderText: { flex: 1, color: "#c4c7c8", fontFamily: "JetBrains Mono", fontSize: fs(11), padding: 14, textAlign: "center" },
  timelineGoalCell: { textAlign: "left" },
  timelineRow: { minHeight: 72, flexDirection: "row", borderTopWidth: 1, borderTopColor: "rgba(68,71,72,0.18)" },
  timelineGoalNameCell: { width: 118, padding: 14, borderRightWidth: 1, borderRightColor: "rgba(68,71,72,0.18)", justifyContent: "center" },
  timelineGoalName: { color: "#ffffff", fontFamily: "Inter", fontSize: fs(15) },
  timelineGoalPriority: { color: "#c4c7c8", fontFamily: "JetBrains Mono", fontSize: fs(11), marginTop: 3 },
  timelineBarArea: { flex: 1, justifyContent: "center", paddingHorizontal: 14 },
  timelineBar: { height: 8, borderRadius: 999 },
  timelineMarker: { position: "absolute", top: 0, bottom: 0, left: "35%", width: 1, backgroundColor: "#ffb4ab" },
  legendRow: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 20 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  legendDot: { width: 6, height: 6, borderRadius: 3 },
  legendLabel: { color: "#c4c7c8", fontFamily: "JetBrains Mono", fontSize: fs(11) },
  attentionPill: { flexShrink: 0, overflow: "hidden", color: "#FFD54F", borderWidth: 1, borderColor: "rgba(255,213,79,0.20)", backgroundColor: "rgba(255,213,79,0.05)", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, fontFamily: "JetBrains Mono", fontSize: fs(9), lineHeight: 13, letterSpacing: 0.5, textTransform: "uppercase" },
  carouselContent: { gap: 14, paddingBottom: 4 },
  paginationRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 14 },
  paginationDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.22)" },
  conflictCard: { minHeight: 154, borderRadius: 12, borderWidth: 1, borderColor: "rgba(68,71,72,0.35)", backgroundColor: "#131313", padding: 20 },
  conflictHeader: { flexDirection: "row", justifyContent: "space-between", gap: 12, marginBottom: 12 },
  conflictTitle: { color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: fs(16), fontWeight: "600", textTransform: "capitalize" },
  conflictSeverity: { color: "#FFD54F", fontFamily: "JetBrains Mono", fontSize: fs(10), textTransform: "uppercase", borderWidth: 1, borderColor: "rgba(255,213,79,0.20)", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  conflictBody: { color: "#c4c7c8", fontFamily: "Inter", fontSize: fs(14), lineHeight: 21 },
  advisorHeading: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 18 },
  advisorTitleWrap: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "flex-start", gap: 10 },
  advisorRefreshButton: { flexShrink: 0, width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", backgroundColor: "rgba(255,255,255,0.06)", alignItems: "center", justifyContent: "center" },
  advisorRefreshButtonActive: { backgroundColor: "#ffffff", borderColor: "#ffffff" },
  advisorLastRun: { color: "#8e9192", fontFamily: "Inter", fontSize: fs(11), lineHeight: 16, marginTop: 5 },
  adviceCard: { minHeight: 172, borderRadius: 12, borderWidth: 1, borderColor: "rgba(68,71,72,0.35)", backgroundColor: "#131313", padding: 18, position: "relative" },
  adviceAccent: { position: "absolute", left: 18, top: 18, bottom: 18, width: 2, backgroundColor: "#05e777" },
  adviceTitle: { color: "#ffffff", marginLeft: 14, fontFamily: "Inter", fontSize: fs(15), fontWeight: "600", marginBottom: 6 },
  adviceBody: { color: "#c4c7c8", marginLeft: 14, fontFamily: "Inter", fontSize: fs(13), lineHeight: 20 },
  adviceRationale: { color: "#8e9192", marginLeft: 14, marginTop: 10, fontFamily: "Inter", fontSize: fs(12), lineHeight: 18 },
  allCanvas: { flex: 1, gap: 20, paddingHorizontal: 24, paddingTop: 38, paddingBottom: 16 },
  backLink: { flexDirection: "row", alignItems: "center", gap: 2 },
  backLinkText: { color: "#c4c7c8", fontFamily: "JetBrains Mono", fontSize: fs(11), letterSpacing: 1.4, textTransform: "uppercase" },
  allHeader: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  allTitle: { color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: fs(32), lineHeight: 40, fontWeight: "700" },
  smallAddButton: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: "#444748", backgroundColor: "#201f1f", alignItems: "center", justifyContent: "center" },
  goalListScroll: { flex: 1 },
  goalList: { gap: 16, paddingBottom: 132 },
  goalCard: { borderRadius: 12, borderWidth: 1, borderColor: "#353534", backgroundColor: "#201f1f", padding: 20, gap: 18, overflow: "hidden" },
  cardPressed: { opacity: 0.86, transform: [{ scale: 0.99 }] },
  goalGlow: { position: "absolute", top: -16, right: -20, width: 130, height: 130, borderRadius: 65, opacity: 0.08 },
  goalCardHeader: { flexDirection: "row", justifyContent: "space-between", gap: 16 },
  goalCardTitle: { flex: 1, color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: fs(24), lineHeight: 32, fontWeight: "600" },
  goalHealth: { alignItems: "flex-end" },
  healthLabel: { color: "#c4c7c8", fontFamily: "JetBrains Mono", fontSize: fs(11), letterSpacing: 1.1, textTransform: "uppercase" },
  goalHealthText: { fontFamily: "Inter", fontSize: fs(15), lineHeight: 22, fontWeight: "600" },
  confidenceText: { color: "#c4c7c8", fontFamily: "JetBrains Mono", fontSize: fs(12), marginTop: 4 },
  confidenceStrong: { color: "#ffffff" },
  goalFactsGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 16, columnGap: 8 },
  goalFactCell: { width: "48%", minHeight: 42, justifyContent: "flex-start" },
  goalFactLabel: { color: "#c4c7c8", fontFamily: "JetBrains Mono", fontSize: fs(12), lineHeight: 17 },
  goalFactValue: { color: "#ffffff", fontFamily: "JetBrains Mono", fontSize: fs(14), lineHeight: 20, marginTop: 2 },
  goalProgressTrack: { height: 6, borderRadius: 999, backgroundColor: "#353534", overflow: "hidden" },
  goalProgressFill: { height: "100%", borderRadius: 999 },
  goalCardFooter: { borderTopWidth: 1, borderTopColor: "#353534", paddingTop: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  goalFooterText: { color: "#c4c7c8", fontFamily: "JetBrains Mono", fontSize: fs(12) },
  emptyGoals: { borderRadius: 12, borderWidth: 1, borderColor: "#353534", padding: 24, gap: 12, alignItems: "center" },
  emptyTitle: { color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: fs(24), fontWeight: "700" },
  fullPrimaryButton: { height: 46, borderRadius: 999, backgroundColor: "#ffffff", paddingHorizontal: 22, alignItems: "center", justifyContent: "center" },
  fullPrimaryButtonText: { color: "#131313", fontFamily: "JetBrains Mono", fontSize: fs(12), fontWeight: "700", textTransform: "uppercase" },
  detailCanvas: { flex: 1, backgroundColor: "#0A0A0A" },
  detailHeader: { height: 80, paddingTop: 14, paddingHorizontal: 24, borderBottomWidth: 1, borderBottomColor: "#444748", backgroundColor: "#131313", flexDirection: "row", alignItems: "center", gap: 12 },
  detailScroll: { flex: 1 },
  detailContent: { gap: 24, padding: 24, paddingBottom: 132 },
  detailBackButton: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  detailTopTitle: { color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: fs(22), fontWeight: "700" },
  detailMainCard: { borderRadius: 12, borderWidth: 1, borderColor: "#333333", backgroundColor: "#1A1A1A", padding: 22, gap: 16 },
  detailCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  detailTitleBlock: { flex: 1, minWidth: 0 },
  detailGoalTitle: { color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: fs(24), fontWeight: "700", marginBottom: 4 },
  detailMeta: { color: "#c4c7c8", fontFamily: "JetBrains Mono", fontSize: fs(12), lineHeight: 18 },
  pipe: { color: "#333333" },
  detailHealthBlock: { flexShrink: 0, alignItems: "flex-end", width: 112 },
  healthValue: { fontFamily: "Hanken Grotesk", fontSize: fs(18), lineHeight: 23, fontWeight: "700", textAlign: "right" },
  detailMetaRow: { flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", rowGap: 8, columnGap: 12 },
  detailMetaSmall: { color: "#c4c7c8", fontFamily: "Inter", fontSize: fs(13), lineHeight: 19 },
  detailMetaStrong: { color: "#ffffff", fontWeight: "700" },
  detailProgressTrack: { height: 8, borderRadius: 999, backgroundColor: "#0A0A0A", overflow: "hidden" },
  detailProgressFill: { height: "100%", borderRadius: 999 },
  editGoalButton: { height: 48, borderRadius: 8, backgroundColor: "#262626", flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" },
  editGoalButtonText: { color: "#ffffff", fontFamily: "JetBrains Mono", fontSize: fs(13), letterSpacing: 1.2, fontWeight: "700" },
  detailSection: { borderRadius: 12, borderWidth: 1, borderColor: "#333333", backgroundColor: "#1A1A1A", padding: 22, gap: 14 },
  recommendedLine: { color: "#00E676", fontFamily: "JetBrains Mono", fontSize: fs(12) },
  milestoneGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  milestoneCard: { width: "47%", borderRadius: 8, borderWidth: 1, borderColor: "#333333", backgroundColor: "#0A0A0A", padding: 14, overflow: "hidden" },
  milestoneCardDone: { borderColor: "rgba(5,231,119,0.35)" },
  milestoneAccent: { position: "absolute", top: 0, bottom: 0, left: 0, width: 3, backgroundColor: "#05e777" },
  milestoneLabel: { color: "#c4c7c8", fontFamily: "JetBrains Mono", fontSize: fs(10), letterSpacing: 1.1, textTransform: "uppercase" },
  milestoneLabelDone: { color: "#05e777" },
  milestoneAmount: { color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: fs(16), marginTop: 6 },
  milestoneStatus: { color: "#c4c7c8", fontFamily: "Inter", fontSize: fs(12), marginTop: 2 },
  nextMilestoneBox: { borderTopWidth: 1, borderTopColor: "#262626", paddingTop: 14 },
  recommendationCard: { borderRadius: 12, borderWidth: 1, borderColor: "rgba(68,71,72,0.45)", backgroundColor: "#0A0A0A", padding: 22 },
  recommendationTitle: { color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: fs(16), fontWeight: "700", marginTop: 10, marginBottom: 14 },
  recommendationHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  recommendationRow: { flexDirection: "row", gap: 12, alignItems: "flex-start", marginBottom: 10 },
  recommendationDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#05e777", marginTop: 7 },
  recommendationText: { flex: 1, color: "#c4c7c8", fontFamily: "Inter", fontSize: fs(14), lineHeight: 21 },
  sheetBackdrop: { flex: 1, backgroundColor: "rgba(10,10,10,0.80)", justifyContent: "flex-end" },
  goalSheet: { maxHeight: "90%", borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderColor: "rgba(255,255,255,0.20)", backgroundColor: "#0A0A0A", overflow: "hidden" },
  grabHandle: { width: 48, height: 6, backgroundColor: "rgba(255,255,255,0.10)", borderRadius: 999, alignSelf: "center", marginTop: 16 },
  goalSheetHeader: { height: 70, paddingHorizontal: 24, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  goalSheetTitle: { color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: fs(24), lineHeight: 32, fontWeight: "700" },
  sheetIconButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.05)", alignItems: "center", justifyContent: "center" },
  goalSheetBody: { paddingHorizontal: 24, paddingVertical: 24, gap: 32 },
  inputGroup: { gap: 16 },
  inputLabel: { color: "#c4c7c8", fontFamily: "Hanken Grotesk", fontSize: fs(11), letterSpacing: 2.2, textTransform: "uppercase", fontWeight: "700" },
  inputWrap: { minHeight: 56, borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", backgroundColor: "#1A1A1A", justifyContent: "center" },
  inputIcon: { position: "absolute", left: 16, zIndex: 2 },
  inputPrefix: { position: "absolute", left: 16, zIndex: 2, color: "#c4c7c8", fontFamily: "JetBrains Mono", fontSize: fs(14) },
  goalInput: { minHeight: 54, color: "#ffffff", paddingHorizontal: 16, paddingRight: 16, fontFamily: "Inter", fontSize: fs(16), lineHeight: 24 },
  goalInputPrefixed: { paddingLeft: 48 },
  goalTextArea: { minHeight: 96, paddingTop: 14, textAlignVertical: "top" },
  goalDateValue: { minHeight: 54, color: "#ffffff", paddingLeft: 48, paddingRight: 46, fontFamily: "Inter", fontSize: fs(16), lineHeight: 54 },
  goalDatePlaceholder: { color: "rgba(196,199,200,0.42)" },
  inputChevron: { position: "absolute", right: 14 },
  goalDateOverlay: { flex: 1, backgroundColor: "rgba(10,10,10,0.84)", padding: 12, justifyContent: "center" },
  goalDateCard: { minHeight: 622, maxHeight: "94%", borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.14)", backgroundColor: "#131313", overflow: "hidden" },
  goalDateHeader: { minHeight: 70, paddingHorizontal: 24, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  goalDateTitle: { color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: fs(24), lineHeight: 32, fontWeight: "600" },
  goalDateContent: { padding: 24, gap: 22 },
  dateSummaryCard: { borderRadius: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", backgroundColor: "#101010", padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
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
  dateTextMuted: { color: "rgba(196,199,200,0.32)" },
  goalDateFooter: { padding: 24, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)", flexDirection: "row", gap: 16, backgroundColor: "#131313" },
  systemNote: { borderRadius: 12, borderWidth: 1, borderColor: "rgba(68,71,72,0.30)", backgroundColor: "#1c1b1b", padding: 16, flexDirection: "row", gap: 12 },
  systemNoteText: { flex: 1, color: "#8e9192", fontFamily: "Inter", fontSize: fs(12), lineHeight: 18 },
  goalSheetFooter: { flexDirection: "row", gap: 16, padding: 24, paddingBottom: 48, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.10)" },
  sheetPrimaryButton: { flex: 1, height: 56, borderRadius: 999, backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center" },
  sheetPrimaryText: { color: "#000000", fontFamily: "Hanken Grotesk", fontSize: fs(14), letterSpacing: 2.1, fontWeight: "700", textTransform: "uppercase" },
  sheetCancelButton: { flex: 1, height: 56, borderRadius: 999, borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", backgroundColor: "rgba(255,255,255,0.05)", alignItems: "center", justifyContent: "center" },
  sheetCancelText: { color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: fs(14), letterSpacing: 2.1, fontWeight: "700", textTransform: "uppercase" },
  sheetDeleteButton: { width: 56, height: 56, borderRadius: 28, borderWidth: 1, borderColor: "rgba(255,180,171,0.24)", backgroundColor: "rgba(255,180,171,0.10)", alignItems: "center", justifyContent: "center" },
  centerState: { minHeight: 420, alignItems: "center", justifyContent: "center", gap: 12 },
  centerText: { color: "#c4c7c8", fontFamily: "Inter", fontSize: fs(14) },
  errorText: { color: "#ffb4ab", fontFamily: "Inter", fontSize: fs(14), lineHeight: 20 },
  retryButton: { height: 42, borderRadius: 999, borderWidth: 1, borderColor: "#444748", paddingHorizontal: 20, justifyContent: "center" },
  retryText: { color: "#ffffff", fontFamily: "JetBrains Mono", fontSize: fs(12), letterSpacing: 1.2, textTransform: "uppercase" },
  toneAheadText: { color: "#7dffa2" },
  toneTrackText: { color: "#b0c6ff" },
  toneRiskText: { color: "#ffb4ab" },
  toneAheadFill: { backgroundColor: "#7dffa2" },
  toneTrackFill: { backgroundColor: "#b0c6ff" },
  toneRiskFill: { backgroundColor: "#ffb4ab" },
  toneAheadGlow: { backgroundColor: "#7dffa2" },
  toneTrackGlow: { backgroundColor: "#b0c6ff" },
  toneRiskGlow: { backgroundColor: "#ffb4ab" },
  toneAheadBarSoft: { backgroundColor: "rgba(5,231,119,0.20)" },
  toneTrackBarSoft: { backgroundColor: "rgba(176,198,255,0.20)" },
  toneRiskBarSoft: { backgroundColor: "rgba(255,180,171,0.20)" },
  toneAheadAccent: { backgroundColor: "#05e777" },
  toneTrackAccent: { backgroundColor: "#b0c6ff" },
  toneRiskAccent: { backgroundColor: "#ffb4ab" },
});
