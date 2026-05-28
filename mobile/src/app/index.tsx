import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  NativeScrollEvent,
  NativeSyntheticEvent,
  useWindowDimensions,
  View,
  LayoutAnimation,
  Easing,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { DashboardSkeleton } from "../components/LoadingSkeleton";
import { formatCurrencyAmount, getGlobalCurrencyCode, useCurrency } from "../providers/CurrencyProvider";
import { useUserProfile } from "../providers/UserProfileProvider";
import { API_BASE_URL } from "../lib/apiBaseUrl";
import { beginHorizontalScroll, endHorizontalScroll, updateHorizontalScroll } from "../lib/horizontalScrollPriority";
import { fetchCachedValue } from "../lib/clientCache";

function mapIconName(name: string) {
  return name ? name.replace(/_/g, "-") : name;
}

type MaterialIconName = React.ComponentProps<typeof MaterialIcons>["name"];

function toMaterialIconName(name: string): MaterialIconName {
  return mapIconName(name) as MaterialIconName;
}

const INSIGHT_ICON_MAP: Record<string, string> = {
  ai_summary: "psychology",
  savings_rate: "savings",
  runway: "flight_takeoff",
  burn_rate: "local_fire_department",
  activity_snapshot: "analytics",
  large_expense: "receipt_long",
  merchant_frequency: "shopping_bag",
  monthly_spend_trend: "trending_down",
  top_category: "category",
  behavior_weekend_spend: "weekend",
  late_food: "restaurant",
  weekend_concentration: "calendar_month",
  behavior_top_merchant: "shopping_bag",
};

function getInsightIconName(type?: string): MaterialIconName {
  return toMaterialIconName(INSIGHT_ICON_MAP[type || ""] || "info");
}

function syncHorizontalScrollPriority(event: NativeSyntheticEvent<NativeScrollEvent>) {
  const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
  updateHorizontalScroll(contentOffset.x, layoutMeasurement.width, contentSize.width);
}

type BalanceData = {
  balance: number;
  lastMonthDelta: number;
  percentChange: number;
};

type SavingsData = {
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlySavings: number;
  savingsRate: number;
  savingsMessage: string;
  currentMonthSavingsRate: number;
  previousMonthSavingsRate: number;
  savingsRateChange: number;
  savingsRateChangeDirection: "increase" | "decrease" | "neutral";
  previousMonthHasData: boolean;
};

type BurnData = {
  burnRate: number;
  previousBurnRate: number;
  burnRateChange: number;
  burnRateChangeDirection: "increase" | "decrease" | "neutral";
  previousPeriodHasData: boolean;
};

type RunwayData = {
  runwayMonths: number | null;
  previousRunwayMonths: number | null;
  runwayChange: number;
  runwayChangeDirection: "increase" | "decrease" | "neutral";
};

type MonthlyPoint = {
  month: string;
  income: number;
  expense: number;
};

type CategoryPoint = {
  name: string;
  value: number;
};

type HeatmapPoint = {
  date: string;
  amount: number;
  weekday: number;
  weekIndex: number;
};

type SeasonalityData = {
  weekdayTotals: Array<{ day: string; value: number }>;
  monthTotals: Array<{ month: string; value: number }>;
  peakWeekday: { day: string; value: number } | null;
  peakMonth: { month: string; value: number } | null;
  weekendShare: number;
  topWeekdays: Array<{ day: string; value: number }>;
  topMonths: Array<{ month: string; value: number }>;
};

type Insight = {
  id?: string;
  type?: string;
  message: string;
  score?: number | null;
};

type DashboardData = {
  balance: BalanceData | null;
  savings: SavingsData | null;
  burn: BurnData | null;
  runway: RunwayData | null;
  monthly: MonthlyPoint[];
  categories: CategoryPoint[];
  heatmap: HeatmapPoint[];
  seasonality: SeasonalityData | null;
  insights: Insight[];
};

function apiUrl(path: string) {
  return `${API_BASE_URL}${path}`;
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(apiUrl(path));
  if (!response.ok) {
    throw new Error(`Request failed for ${path}`);
  }

  const payload = await response.json();
  const data = payload.data ?? payload.insights;
  if (data === undefined || data === null) {
    throw new Error(`Empty response for ${path}`);
  }

  return data as T;
}

async function loadDashboard(force = false): Promise<DashboardData> {
  return fetchCachedValue(
    "dashboard",
    async () => {
      const [balance, savings, burn, runway, monthly, categories, heatmap, seasonality, insights] = await Promise.all([
        fetchJson<BalanceData>("/api/analytics/balance"),
        fetchJson<SavingsData>("/api/analytics/savings-rate"),
        fetchJson<BurnData>("/api/analytics/burn-rate"),
        fetchJson<RunwayData>("/api/analytics/runway"),
        fetchJson<MonthlyPoint[]>("/api/analytics/monthly"),
        fetchJson<CategoryPoint[]>("/api/analytics/categories"),
        fetchJson<HeatmapPoint[]>("/api/analytics/heatmap"),
        fetchJson<SeasonalityData>("/api/analytics/seasonality"),
        fetchJson<Insight[]>("/api/insights/generate"),
      ]);

      const resolvedBalance: BalanceData = balance;
      const nextBalance: BalanceData =
        resolvedBalance.percentChange === null || resolvedBalance.percentChange === undefined
          ? (() => {
            const prev = resolvedBalance.balance - resolvedBalance.lastMonthDelta;
            const pct = prev !== 0 ? (resolvedBalance.lastMonthDelta / prev) * 100 : 0;
            return { ...resolvedBalance, percentChange: Number(pct.toFixed(1)) };
          })()
          : resolvedBalance;

      return {
        balance: nextBalance,
        savings,
        burn,
        runway,
        monthly,
        categories,
        heatmap,
        seasonality,
        insights,
      };
    },
    { force },
  );
}

function formatCurrency(value: number, digits = 0) {
  return formatCurrencyAmount(value, undefined, digits);
}

function formatCompactCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: getGlobalCurrencyCode(),
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 1,
  })
    .format(value)
    .replace(/\.0(?=[kmb])/i, "");
}

function monthLabel(monthValue: string) {
  if (monthValue.length <= 4) {
    return monthValue.toUpperCase();
  }

  const monthPart = monthValue.slice(-2);
  const monthIndex = Number(monthPart) - 1;
  const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  return monthNames[monthIndex] ?? monthValue;
}

function formatHeatmapDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

function SectionHeading({ title, actionLabel, iconName, onActionPress }: { title: string; actionLabel?: string; iconName?: string; onActionPress?: () => void }) {
  return (
    <View style={styles.sectionHeadingRow}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        {iconName ? (
          <View style={styles.sectionIconWrap}>
            <MaterialIcons name={toMaterialIconName(iconName)} size={16} color="#ffffff" style={{ transform: [{ scaleX: -1 }] }} />
          </View>
        ) : null}
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {actionLabel ? (
        <Pressable style={styles.actionPill} onPress={onActionPress}>
          <Text style={styles.actionLabel}>{actionLabel}</Text>
          <Text style={styles.actionArrow}>→</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function EmptyPanel({ title, message }: { title: string; message: string }) {
  return (
    <View style={styles.emptyPanel}>
      <Text style={styles.emptyPanelTitle}>{title}</Text>
      <Text style={styles.emptyPanelMessage}>{message}</Text>
    </View>
  );
}

function MetricCard({
  label,
  value,
  note,
  noteTone = "neutral",
  icon,
  wide,
}: {
  label: string;
  value: string;
  note: string;
  noteTone?: "neutral" | "positive" | "negative";
  icon: string;
  wide?: boolean;
}) {
  return (
    <View style={[styles.metricCard, wide ? styles.metricCardWide : null]}>
      <View style={styles.metricHeader}>
        <Text style={styles.metricLabel}>{label}</Text>
        <MaterialIcons name={toMaterialIconName(icon)} size={16} color="#c4c7c8" />
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text
        style={[
          styles.metricNote,
          noteTone === "positive" ? styles.successText : null,
          noteTone === "negative" ? styles.dangerText : null,
          noteTone === "neutral" ? styles.mutedText : null,
        ]}
      >
        {note}
      </Text>
    </View>
  );
}

function InsightCard({ insight }: { insight: Insight }) {
  const label = insight.type ? insight.type.replace(/_/g, " ") : "insight";

  return (
    <View style={styles.carouselCard}>
      <View style={styles.insightHeading}>
        <View style={styles.insightIcon}>
          <MaterialIcons name={getInsightIconName(insight.type)} size={19} color="#7dffa2" style={{ transform: [{ translateY: 0 }] }} />
        </View>
        <Text style={styles.carouselEyebrow}>{label}</Text>
      </View>
      <Text style={styles.insightBody} numberOfLines={3} ellipsizeMode="tail">
        {insight.message}
      </Text>
    </View>
  );
}

function TrendChart({
  data,
  width,
  selectedIndex,
  onSelectIndex,
  onBoundsChange,
}: {
  data: MonthlyPoint[];
  width: number;
  selectedIndex: number | null;
  onSelectIndex: (index: number) => void;
  onBoundsChange?: (bounds: { x: number; y: number; width: number; height: number }) => void;
}) {
  const chartRef = useRef<View>(null);
  const chartHeight = "100%";
  const chartWidth = Math.max(240, width - 32);

  if (!data.length) {
    return (
      <View ref={chartRef} style={[styles.chartWrap, { height: chartHeight, width: chartWidth }]}>
        <EmptyPanel title="No cashflow data" message="Monthly analytics have not been returned by the backend yet." />
      </View>
    );
  }

  const chartData = data.slice(-6);
  const viewBoxWidth = 360;
  const viewBoxHeight = 180;
  const padding = { top: 14, right: 12, bottom: 28, left: 12 };
  const plotWidth = viewBoxWidth - padding.left - padding.right;
  const plotHeight = viewBoxHeight - padding.top - padding.bottom;
  const maxValue = Math.max(...chartData.flatMap((item) => [item.income, item.expense]), 1);
  const minValue = Math.min(...chartData.flatMap((item) => [item.income, item.expense]), 0);
  const valueRange = Math.max(maxValue - minValue, maxValue * 0.2, 1);
  const baseline = padding.top + plotHeight;
  const points = chartData.map((item, index) => {
    const x = chartData.length > 1 ? padding.left + (plotWidth / (chartData.length - 1)) * index : padding.left + plotWidth / 2;
    const incomeY = padding.top + (1 - (item.income - minValue) / valueRange) * plotHeight;
    const expenseY = padding.top + (1 - (item.expense - minValue) / valueRange) * plotHeight;

    return {
      label: monthLabel(item.month),
      x,
      incomeY,
      expenseY,
    };
  });

  const buildSmoothPath = (series: Array<{ x: number; y: number }>) => {
    if (!series.length) {
      return "";
    }

    if (series.length === 1) {
      return `M ${series[0].x} ${series[0].y}`;
    }

    let path = `M ${series[0].x} ${series[0].y}`;
    for (let index = 0; index < series.length - 1; index += 1) {
      const current = series[index];
      const next = series[index + 1];
      const midX = (current.x + next.x) / 2;
      path += ` C ${midX} ${current.y}, ${midX} ${next.y}, ${next.x} ${next.y}`;
    }

    return path;
  };

  const incomeSeries = points.map((point) => ({ x: point.x, y: point.incomeY }));
  const expenseSeries = points.map((point) => ({ x: point.x, y: point.expenseY }));
  const incomePath = buildSmoothPath(incomeSeries);
  const expensePath = buildSmoothPath(expenseSeries);
  const areaPath = points.length ? `${incomePath} L ${points[points.length - 1].x} ${baseline} L ${points[0].x} ${baseline} Z` : "";

  const activeIndex = selectedIndex === null ? -1 : Math.min(selectedIndex, points.length - 1);
  const selectedPoint = activeIndex >= 0 ? points[activeIndex] ?? null : null;

  useEffect(() => {
    if (!onBoundsChange) {
      return;
    }

    const handle = requestAnimationFrame(() => {
      chartRef.current?.measureInWindow((x, y, measuredWidth, measuredHeight) => {
        onBoundsChange({ x, y, width: measuredWidth, height: measuredHeight });
      });
    });

    return () => cancelAnimationFrame(handle);
  }, [chartWidth, onBoundsChange]);

  const handleChartPress = (locationX: number) => {
    if (!points.length) {
      return;
    }

    const viewBoxX = (locationX / chartWidth) * viewBoxWidth;
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;

    points.forEach((point, index) => {
      const distance = Math.abs(point.x - viewBoxX);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });

    onSelectIndex(nearestIndex);
  };

  return (
    <View ref={chartRef} style={[styles.chartWrap, { height: chartHeight, width: chartWidth }]}>
      <View style={styles.chartLegendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.legendDotSuccess]} />
          <Text style={styles.legendText}>Inflow</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.legendDotMuted]} />
          <Text style={styles.legendText}>Outflow</Text>
        </View>
        <Text style={styles.legendTrend}>6 MO TREND</Text>
      </View>

      <View style={styles.chartArea}>
        <Pressable style={styles.chartPressTarget} onPress={(event) => handleChartPress(event.nativeEvent.locationX)}>
          <Svg width={chartWidth} height={viewBoxHeight} viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`} preserveAspectRatio="none" style={styles.chartSvg}>
            <Defs>
              <LinearGradient id="inflowFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor="#ffffff" stopOpacity={0.18} />
                <Stop offset="100%" stopColor="#ffffff" stopOpacity={0.02} />
              </LinearGradient>
              <LinearGradient id="inflowStroke" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0%" stopColor="#ffffff" stopOpacity={0.8} />
                <Stop offset="100%" stopColor="#7dffa2" stopOpacity={1} />
              </LinearGradient>
            </Defs>

            <Rect x={0} y={0} width={viewBoxWidth} height={viewBoxHeight} rx={20} fill="transparent" />
            <Line x1={padding.left} y1={padding.top} x2={viewBoxWidth - padding.right} y2={padding.top} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
            <Line x1={padding.left} y1={padding.top + plotHeight / 2} x2={viewBoxWidth - padding.right} y2={padding.top + plotHeight / 2} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
            <Line x1={padding.left} y1={baseline} x2={viewBoxWidth - padding.right} y2={baseline} stroke="rgba(255,255,255,0.1)" strokeWidth={1} />

            {areaPath ? <Path d={areaPath} fill="url(#inflowFill)" /> : null}
            {incomePath ? <Path d={incomePath} fill="none" stroke="url(#inflowStroke)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" /> : null}
            {expensePath ? <Path d={expensePath} fill="none" stroke="rgba(58,57,57,0.95)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /> : null}

            {selectedPoint ? <Line x1={selectedPoint.x} y1={padding.top - 2} x2={selectedPoint.x} y2={baseline + 8} stroke="rgba(125,255,162,0.16)" strokeWidth={1} strokeDasharray="4 4" /> : null}

            {points.map((point, index) => (
              <G key={`points-${point.label}`}>
                <Circle cx={point.x} cy={point.expenseY} r={3.4} fill="#131313" stroke="#3a3939" strokeWidth={1.4} />
                <Circle
                  cx={point.x}
                  cy={point.incomeY}
                  r={index === activeIndex ? 5 : 3.8}
                  fill={index === activeIndex ? "#7dffa2" : "#131313"}
                  stroke={index === activeIndex ? "#7dffa2" : "#ffffff"}
                  strokeWidth={index === activeIndex ? 0 : 1.2}
                  opacity={index === activeIndex ? 1 : 0.96}
                />
                {index === activeIndex ? <Circle cx={point.x} cy={point.incomeY} r={10} fill="#7dffa2" opacity={0.12} /> : null}
              </G>
            ))}
          </Svg>

          {selectedPoint ? (
            <View style={styles.chartTooltip} pointerEvents="none">
              <Text style={styles.chartTooltipLabel}>{selectedPoint.label}</Text>
              <View style={styles.chartTooltipRow}>
                <View style={styles.chartTooltipKeyRow}>
                  <View style={styles.chartTooltipDotSuccess} />
                  <Text style={styles.chartTooltipKey}>Inflow</Text>
                </View>
                <Text style={styles.chartTooltipValue}>{formatCompactCurrency(chartData[activeIndex]?.income ?? 0)}</Text>
              </View>
              <View style={styles.chartTooltipRow}>
                <View style={styles.chartTooltipKeyRow}>
                  <View style={styles.chartTooltipDotMuted} />
                  <Text style={styles.chartTooltipKey}>Outflow</Text>
                </View>
                <Text style={styles.chartTooltipValue}>{formatCompactCurrency(chartData[activeIndex]?.expense ?? 0)}</Text>
              </View>
            </View>
          ) : null}
        </Pressable>
        <View style={styles.chartAxisRow}>
          {points.map((point) => (
            <Text key={point.label} style={styles.chartAxisLabel}>
              {point.label}
            </Text>
          ))}
        </View>
      </View>
    </View>
  );
}

function Heatmap({
  cells,
  selectedCell,
  onSelectCell,
  onBoundsChange,
}: {
  cells: HeatmapPoint[];
  selectedCell: HeatmapPoint | null;
  onSelectCell: (cell: HeatmapPoint) => void;
  onBoundsChange?: (bounds: { x: number; y: number; width: number; height: number }) => void;
}) {
  const heatmapRef = useRef<View>(null);

  if (!cells.length) {
    return (
      <View style={styles.heatmapCard}>
        <EmptyPanel title="No heatmap data" message="Spend activity for the last 30 days is unavailable right now." />
      </View>
    );
  }

  // Tooltip removed: keep the chart and list only.
  const visibleCells = cells.slice(-30);
  const max = Math.max(...visibleCells.map((item) => item.amount), 1);
  const weekCount = Math.max(1, Math.ceil(visibleCells.length / 7));
  const weekMatrix = Array.from({ length: weekCount }, () => Array.from({ length: 7 }, () => null as HeatmapPoint | null));
  const firstWeekday = visibleCells[0]?.weekday ?? 0;

  visibleCells.forEach((cell, index) => {
    const slot = firstWeekday + index;
    const weekIndex = Math.floor(slot / 7);
    const weekday = slot % 7;

    if (weekMatrix[weekIndex]) {
      weekMatrix[weekIndex][weekday] = cell;
    }
  });

  const dayLabels = ["M", "T", "W", "T", "F", "S", "S"];

  useEffect(() => {
    if (!onBoundsChange) {
      return;
    }

    const handle = requestAnimationFrame(() => {
      heatmapRef.current?.measureInWindow((x, y, width, height) => {
        onBoundsChange({ x, y, width, height });
      });
    });

    return () => cancelAnimationFrame(handle);
  }, [weekCount, onBoundsChange]);

  return (
    <View ref={heatmapRef} style={styles.heatmapCard}>
      <Text style={styles.carouselEyebrow}>SPENDING HEATMAP (30 DAYS)</Text>
      <View style={styles.heatmapGrid}>
        {dayLabels.map((label, i) => (
          <Text key={`${label}-${i}`} style={styles.heatmapDayLabel}>
            {label}
          </Text>
        ))}
        {weekMatrix.map((week, weekIndex) =>
          week.map((cell, weekday) => {
            if (!cell) {
              return <View key={`empty-${weekIndex}-${weekday}`} style={[styles.heatmapCell, styles.heatmapCellEmpty]} />;
            }

            const normalized = max > 0 ? cell.amount / max : 0;
            const isSelected = selectedCell?.date === cell.date;

            return (
              <Pressable
                key={cell.date}
                onPress={() => onSelectCell(cell)}
                style={[
                  styles.heatmapCell,
                  normalized === 0 ? styles.heatmapCellEmpty : null,
                  normalized < 0.15 ? styles.heatmapLow : null,
                  normalized >= 0.15 && normalized < 0.35 ? styles.heatmapMedLow : null,
                  normalized >= 0.35 && normalized < 0.6 ? styles.heatmapMed : null,
                  normalized >= 0.6 && normalized < 0.8 ? styles.heatmapHigh : null,
                  normalized >= 0.8 ? styles.heatmapPeak : null,
                  isSelected ? styles.heatmapCellSelected : null,
                ]}
              />
            );
          }),
        )}
      </View>
      {selectedCell ? (
        <View style={styles.heatmapTooltip} pointerEvents="none">
          <Text style={styles.heatmapTooltipLabel}>{formatHeatmapDate(selectedCell.date)}</Text>
          <View style={styles.chartTooltipRow}>
            <View style={styles.chartTooltipKeyRow}>
              <View style={styles.chartTooltipDotSuccess} />
              <Text style={styles.chartTooltipKey}>Amount</Text>
            </View>
            <Text style={styles.chartTooltipValue}>{formatCompactCurrency(selectedCell.amount)}</Text>
          </View>
        </View>
      ) : null}
      <View style={styles.legendFooter}>
        <Text style={styles.legendHint}>Low</Text>
        <View style={styles.legendSwatches}>
          <View style={[styles.legendSwatch, styles.heatmapCellEmpty]} />
          <View style={[styles.legendSwatch, styles.heatmapMedLow]} />
          <View style={[styles.legendSwatch, styles.heatmapHigh]} />
          <View style={[styles.legendSwatch, styles.heatmapPeak]} />
        </View>
        <Text style={styles.legendHint}>High</Text>
      </View>
    </View>
  );
}

function CategoryRing({
  categories,
  selectedCategory,
  onSelectCategory,
  onBoundsChange,
}: {
  categories: CategoryPoint[];
  selectedCategory: CategoryPoint | null;
  onSelectCategory: (category: CategoryPoint | null) => void;
  onBoundsChange?: (bounds: { x: number; y: number; width: number; height: number }) => void;
}) {
  // Tooltip removed: keep the chart and list only.
  const total = categories.reduce((sum, category) => sum + category.value, 0);
  const colors = ["#7dffa2", "#00e475", "#c4c7c8", "#ffffff", "#2979ff"];
  const radius = 68;
  const strokeWidth = 14;
  const center = 95;
  const circumference = 2 * Math.PI * radius;
  const segmentCategories = categories.filter((category) => category.value > 0);
  const donutSegments = segmentCategories.reduce(
    (segments, category, index) => {
      const percentage = total > 0 ? category.value / total : 0;
      const segmentLength = Math.max(percentage * circumference, circumference * 0.04);
      const color = colors[index % colors.length];
      const currentOffset = segments.offset;

      segments.nodes.push({
        key: category.name,
        color,
        segmentLength,
        offset: currentOffset,
        opacity: 0.78 + index * 0.06,
      });
      segments.offset += segmentLength;

      return segments;
    },
    { offset: 0, nodes: [] as Array<{ key: string; color: string; segmentLength: number; offset: number; opacity: number }> },
  ).nodes;

  // No tooltip animation/effects — selection handled by parent state.

  const selectedIndex = selectedCategory ? categories.findIndex((category) => category.name === selectedCategory.name) : -1;

  const handleRingPress = (locationX: number, locationY: number) => {
    if (!segmentCategories.length) {
      return;
    }

    const dx = locationX - center;
    const dy = locationY - center;
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    const normalizedAngle = (angle + 450) % 360;

    let cumulative = 0;
    let closestCategory = segmentCategories[0];

    for (const category of segmentCategories) {
      const percentage = total > 0 ? category.value / total : 0;
      const span = Math.max(percentage * 360, 14);
      const start = cumulative;
      const end = cumulative + span;

      if (normalizedAngle >= start && normalizedAngle < end) {
        closestCategory = category;
        break;
      }

      cumulative += span;
      closestCategory = category;
    }

    onSelectCategory(closestCategory);
  };

  // Smoothly animate layout changes (padding/background) when selection changes
  useEffect(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }, [selectedCategory]);

  // Animated values per row for smooth transitions
  const animatedRowValuesRef = useRef<Animated.Value[]>([]);

  // Ensure animated values exist for the current number of categories
  useEffect(() => {
    const values = animatedRowValuesRef.current;
    if (values.length !== categories.length) {
      animatedRowValuesRef.current = categories.map((_, i) => values[i] ?? new Animated.Value(0));
    }
  }, [categories.length]);

  // Animate when selectedIndex changes
  useEffect(() => {
    const toVals = animatedRowValuesRef.current.map((_, i) => (selectedIndex === i ? 1 : 0));
    const animations = toVals.map((toVal, i) =>
      Animated.timing(animatedRowValuesRef.current[i], {
        toValue: toVal,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      })
    );

    Animated.parallel(animations).start();
  }, [selectedIndex]);

  const activePercentage = selectedCategory && total > 0 ? Math.round((selectedCategory.value / total) * 100) : 0;

  return (
    <View style={styles.categoryCard}>
      <Text style={styles.carouselEyebrow}>CATEGORY BREAKDOWN</Text>
      <View style={styles.ringWrap}>
        <Pressable style={styles.ringChart} onPress={(event) => handleRingPress(event.nativeEvent.locationX, event.nativeEvent.locationY)}>
          <Svg width={190} height={190} viewBox="0 0 190 190">
            <Defs>
              <LinearGradient id="categoryRingBase" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0%" stopColor="#3a3939" />
                <Stop offset="100%" stopColor="#2a2a2a" />
              </LinearGradient>
            </Defs>

            <Circle cx={center} cy={center} r={radius} fill="none" stroke="url(#categoryRingBase)" strokeWidth={strokeWidth} />
            <G rotation={-90} originX={center} originY={center}>
              {donutSegments.map((segment) => (
                <Circle
                  key={segment.key}
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeDasharray={`${segment.segmentLength} ${circumference - segment.segmentLength}`}
                  strokeDashoffset={-segment.offset}
                  opacity={segment.opacity}
                />
              ))}
            </G>

            <Circle cx={center} cy={center} r={52} fill="#131313" />
            <Circle cx={center} cy={center} r={52} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
            <Circle cx={center} cy={center} r={74} fill="none" stroke="rgba(125,255,162,0.06)" strokeWidth={1} />
          </Svg>
          <View style={styles.ringCenterOverlay}>
            <Text style={styles.ringCenterText}>30 Days</Text>
            <Text style={styles.ringCenterSubtext}>Spending mix</Text>
          </View>
        </Pressable>
      </View>
      {/* tooltip removed */}
      <View style={styles.categoryList}>
        {categories.map((category, index) => {
          const anim = animatedRowValuesRef.current[index] ?? new Animated.Value(0);
          const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.02] });
          const bg = anim.interpolate({ inputRange: [0, 1], outputRange: ["transparent", "rgba(125,255,162,0.12)"] });
          const dotScale = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });

          return (
            <Pressable key={category.name} onPress={() => onSelectCategory(category)} android_ripple={{ color: "rgba(255,255,255,0.02)" }}>
              <Animated.View style={[styles.categoryRow, { transform: [{ scale }], backgroundColor: bg }]}>
                <View style={styles.categoryLabelWrap}>
                  <Animated.View style={[styles.categoryDot, { backgroundColor: colors[index % colors.length], transform: [{ scale: dotScale }] }]} />
                  <Text style={styles.categoryLabel}>{category.name}</Text>
                </View>
                <Text style={styles.categoryPercent}>{`${total > 0 ? Math.round((category.value / total) * 100) : 0}% • ${formatCompactCurrency(category.value)}`}</Text>
              </Animated.View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function PatternCarousel({ seasonality }: { seasonality: SeasonalityData | null }) {
  if (!seasonality) {
    return (
      <View style={styles.patternCard}>
        <EmptyPanel title="No seasonality data" message="Day and month patterns will show up after the backend computes them." />
      </View>
    );
  }

  const peakWeekday = seasonality?.peakWeekday?.day ?? "Wed";
  const peakMonth = seasonality?.peakMonth?.month ?? "May";
  const weekendShare = seasonality?.weekendShare ?? 3;

  return (
    <View style={styles.patternCard}>
      <View>
        <Text style={styles.carouselEyebrow}>SPENDING BEHAVIOR</Text>
        <Text style={styles.cardSubcopy}>Day-of-week and month-of-year spending behavior</Text>
      </View>
      <View style={styles.patternGrid}>
        <View style={styles.patternStatBox}>
          <Text style={styles.patternStatLabel}>Peak weekday</Text>
          <Text style={styles.patternStatValue}>{peakWeekday}</Text>
        </View>
        <View style={styles.patternStatBox}>
          <Text style={styles.patternStatLabel}>Peak month</Text>
          <Text style={styles.patternStatValue}>{peakMonth}</Text>
        </View>
      </View>
      <View style={styles.patternCallout}>
        <Text style={styles.patternCalloutText}>
          Weekend spending accounts for <Text style={styles.successInline}>{weekendShare}%</Text> of tracked spend.
        </Text>
      </View>
    </View>
  );
}

function compactInsights(insights: Insight[]) {
  return insights.slice(0, 3);
}

export default function Index() {
  useCurrency();
  const { firstName } = useUserProfile();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const cardWidth = Math.max(width - 48, 280);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cashflowSelection, setCashflowSelection] = useState<number | null>(null);
  const [cashflowChartBounds, setCashflowChartBounds] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [heatmapSelection, setHeatmapSelection] = useState<HeatmapPoint | null>(null);
  const [heatmapBounds, setHeatmapBounds] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [categorySelection, setCategorySelection] = useState<CategoryPoint | null>(null);
  const [categoryBounds, setCategoryBounds] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [advisorScrollX] = useState(() => new Animated.Value(0));
  const [dynamicsScrollX] = useState(() => new Animated.Value(0));
  const [patternsScrollX] = useState(() => new Animated.Value(0));

  const insights = useMemo(() => compactInsights(dashboard?.insights ?? []), [dashboard?.insights]);

  const load = async (force = false) => {
    setError(null);
    try {
      const nextDashboard = await loadDashboard(force);
      setDashboard(nextDashboard);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Failed to load dashboard data.";
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDashboardTouchStart = (event: { nativeEvent: { pageX: number; pageY: number } }) => {
    const { pageX, pageY } = event.nativeEvent;
    const insideCashflowChart =
      cashflowChartBounds !== null &&
      pageX >= cashflowChartBounds.x &&
      pageX <= cashflowChartBounds.x + cashflowChartBounds.width &&
      pageY >= cashflowChartBounds.y &&
      pageY <= cashflowChartBounds.y + cashflowChartBounds.height;
    const insideHeatmap =
      heatmapBounds !== null &&
      pageX >= heatmapBounds.x &&
      pageX <= heatmapBounds.x + heatmapBounds.width &&
      pageY >= heatmapBounds.y &&
      pageY <= heatmapBounds.y + heatmapBounds.height;

    if (!insideCashflowChart) {
      setCashflowSelection(null);
    }

    if (!insideHeatmap) {
      setHeatmapSelection(null);
    }

    const insideCategoryRing =
      categoryBounds !== null &&
      pageX >= categoryBounds.x &&
      pageX <= categoryBounds.x + categoryBounds.width &&
      pageY >= categoryBounds.y &&
      pageY <= categoryBounds.y + categoryBounds.height;

    if (!insideCategoryRing) {
      setCategorySelection(null);
    }
  };

  const renderCarouselDots = (scrollX: Animated.Value, count: number) => (
    <View style={styles.paginationRow}>
      {Array.from({ length: count }, (_, index) => {
        const inputRange = [
          (index - 1) * (cardWidth + 16),
          index * (cardWidth + 16),
          (index + 1) * (cardWidth + 16),
        ];

        return (
          <Animated.View
            key={`dot-${count}-${index}`}
            style={[
              styles.paginationDot,
              {
                width: scrollX.interpolate({ inputRange, outputRange: [6, 18, 6], extrapolate: "clamp" }),
                opacity: scrollX.interpolate({ inputRange, outputRange: [0.28, 1, 0.28], extrapolate: "clamp" }),
                backgroundColor: scrollX.interpolate({ inputRange, outputRange: ["rgba(255,255,255,0.22)", "#7dffa2", "rgba(255,255,255,0.22)"], extrapolate: "clamp" }),
              },
            ]}
          />
        );
      })}
    </View>
  );

  if (loading || !dashboard) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right", "bottom"]}>
        <StatusBar barStyle="light-content" />
        <DashboardSkeleton />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right", "bottom"]}>
        <StatusBar barStyle="light-content" />
        <View style={styles.errorScreen}>
          <View style={styles.errorCard}>
            <Text style={styles.errorEyebrow}>DASHBOARD ERROR</Text>
            <Text style={styles.errorTitle}>Could not load financial data</Text>
            <Text style={styles.errorMessage}>{error}</Text>
            <Pressable
              onPress={() => {
                setRefreshing(true);
                void load(true);
              }}
              style={styles.errorButton}
            >
              <Text style={styles.errorButtonText}>Retry</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (!dashboard) {
    return null;
  }

  const balance: BalanceData = dashboard.balance!;
  const savings: SavingsData = dashboard.savings!;
  const burn: BurnData = dashboard.burn!;
  const runway: RunwayData = dashboard.runway!;

  const balanceChangeColor = balance.lastMonthDelta >= 0 ? styles.successText : styles.dangerText;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right", "bottom"]}>
      <StatusBar barStyle="light-content" />
      <View style={styles.backgroundGlowLeft} />
      <View style={styles.backgroundGlowRight} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        onTouchStart={handleDashboardTouchStart}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load(true);
            }}
            tintColor="#7dffa2"
          />
        }
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.helloText}>Hello, {firstName}</Text>
            <View style={styles.headerDivider} />
          </View>
        </View>

        <View style={styles.balanceSection}>
          <Text style={styles.sectionEyebrow}>BALANCE</Text>
          <View style={styles.balanceRow}>
            <Text style={styles.balanceValue}>{formatCurrency(balance.balance, 0)}</Text>
            <View style={styles.percentPill}>
              <MaterialIcons name={toMaterialIconName(balance.lastMonthDelta >= 0 ? "trending_up" : "trending_down")} size={14} color={balance.lastMonthDelta >= 0 ? "#7dffa2" : "#ffb4ab"} />
              <Text style={[styles.percentText, balanceChangeColor]}>{`${balance.percentChange >= 0 ? "+" : ""}${Math.abs(balance.percentChange).toFixed(1)}%`}</Text>
            </View>
          </View>
        </View>

        <View style={styles.kpiGrid}>
          <MetricCard
            label="Saving rate"
            value={`${Math.round(savings.currentMonthSavingsRate || savings.savingsRate)}%`}
            note={savings.previousMonthHasData ? `${savings.savingsRateChange > 0 ? "+" : ""}${Math.abs(Math.round(savings.savingsRateChange))}% vs last month` : "Target: 60%"}
            noteTone={savings.previousMonthHasData ? (savings.savingsRateChange > 0 ? "positive" : savings.savingsRateChange < 0 ? "negative" : "neutral") : "neutral"}
            icon="savings"
          />
          <MetricCard
            label="Burn rate"
            value={formatCompactCurrency(burn.burnRate)}
            note={burn.previousPeriodHasData ? `${burn.burnRateChange > 0 ? "+" : ""}${Math.abs(Math.round(burn.burnRateChange))}% vs prev mo` : "No prior period to compare"}
            noteTone={burn.previousPeriodHasData ? (burn.burnRateChange < 0 ? "positive" : burn.burnRateChange > 0 ? "negative" : "neutral") : "neutral"}
            icon="local_fire_department"
          />
          <MetricCard
            label="Runway"
            value={runway.runwayMonths === null ? "Unlimited" : `${runway.runwayMonths.toFixed(1)} mo`}
            note="Cash equivalents"
            icon="flight_takeoff"
            wide
          />
        </View>

        <SectionHeading title="Advisor Summary" actionLabel="INSIGHTS" iconName="psychology" onActionPress={() => router.push("/insights")} />
        {insights.length ? (
          <>
            <Animated.ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={cardWidth + 16}
              decelerationRate="fast"
              contentContainerStyle={styles.carouselContent}
              onTouchStart={beginHorizontalScroll}
              onTouchEnd={endHorizontalScroll}
              onTouchCancel={endHorizontalScroll}
              onScrollBeginDrag={beginHorizontalScroll}
              onScrollEndDrag={endHorizontalScroll}
              onMomentumScrollEnd={endHorizontalScroll}
              onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: advisorScrollX } } }], { useNativeDriver: false, listener: syncHorizontalScrollPriority })}
              scrollEventThrottle={16}
            >
              {insights.map((insight, index) => (
                <View key={insight.id ?? `${insight.type ?? "insight"}-${index}`} style={[styles.carouselItem, { width: cardWidth }]}>
                  <InsightCard insight={insight} />
                </View>
              ))}
            </Animated.ScrollView>
            {renderCarouselDots(advisorScrollX, insights.length)}
          </>
        ) : (
          <View style={[styles.carouselItem, { width: cardWidth }]}>
            <EmptyPanel title="No insights yet" message="The backend has not generated dashboard insights yet." />
          </View>
        )}

        <SectionHeading title="Spending Dynamics" />
        <Animated.ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={cardWidth + 16}
          decelerationRate="fast"
          contentContainerStyle={styles.carouselContent}
          onTouchStart={beginHorizontalScroll}
          onTouchEnd={endHorizontalScroll}
          onTouchCancel={endHorizontalScroll}
          onScrollBeginDrag={beginHorizontalScroll}
          onScrollEndDrag={endHorizontalScroll}
          onMomentumScrollEnd={endHorizontalScroll}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: dynamicsScrollX } } }], { useNativeDriver: false, listener: syncHorizontalScrollPriority })}
          scrollEventThrottle={16}
        >
          <View style={[styles.carouselItem, { width: cardWidth }]}>
            <View style={styles.chartCard}>
              <TrendChart
                data={dashboard.monthly}
                width={cardWidth}
                selectedIndex={cashflowSelection}
                onSelectIndex={setCashflowSelection}
                onBoundsChange={setCashflowChartBounds}
              />
            </View>
          </View>
          <View style={[styles.carouselItem, { width: cardWidth }]}>
            <View style={styles.chartCard}>
              <Heatmap
                cells={dashboard.heatmap}
                selectedCell={heatmapSelection}
                onSelectCell={setHeatmapSelection}
                onBoundsChange={setHeatmapBounds}
              />
            </View>
          </View>
        </Animated.ScrollView>
        {renderCarouselDots(dynamicsScrollX, 2)}

        <SectionHeading title="Category Analysis" />
        <CategoryRing
          categories={dashboard.categories}
          selectedCategory={categorySelection}
          onSelectCategory={setCategorySelection}
          onBoundsChange={setCategoryBounds}
        />

        <SectionHeading title="Spending Patterns" />
        <Animated.ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={cardWidth + 16}
          decelerationRate="fast"
          contentContainerStyle={styles.carouselContent}
          onTouchStart={beginHorizontalScroll}
          onTouchEnd={endHorizontalScroll}
          onTouchCancel={endHorizontalScroll}
          onScrollBeginDrag={beginHorizontalScroll}
          onScrollEndDrag={endHorizontalScroll}
          onMomentumScrollEnd={endHorizontalScroll}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: patternsScrollX } } }], { useNativeDriver: false, listener: syncHorizontalScrollPriority })}
          scrollEventThrottle={16}
        >
          <View style={[styles.carouselItem, { width: cardWidth }]}>
            <PatternCarousel seasonality={dashboard.seasonality} />
          </View>
          <View style={[styles.carouselItem, { width: cardWidth }]}>
            <View style={styles.patternCard}>
              <View>
                <Text style={styles.carouselEyebrow}>SPENDING ACCELERATION</Text>
                <Text style={styles.cardSubcopy}>Compares recent weekly spend vs the prior 4 weeks</Text>
              </View>
              <View style={styles.patternGrid}>
                <View style={styles.patternStatBox}>
                  <Text style={styles.patternStatLabel}>Recent avg</Text>
                  <Text style={styles.patternStatValue}>{formatCompactCurrency(burn.burnRate)}</Text>
                </View>
                <View style={styles.patternStatBox}>
                  <Text style={styles.patternStatLabel}>Previous avg</Text>
                  <Text style={[styles.patternStatValue, styles.mutedText]}>N/A</Text>
                </View>
              </View>
              <View style={styles.patternCallout}>
                <Text style={styles.patternCalloutText}>Not enough prior spending history to compute a meaningful acceleration comparison yet.</Text>
              </View>
            </View>
          </View>
        </Animated.ScrollView>
        {renderCarouselDots(patternsScrollX, 2)}

      </ScrollView>
    </SafeAreaView>
  );
}

const fs = (size: number) => Math.round(size * 0.9 * 10) / 10;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#131313",
  },
  container: {
    flex: 1,
    backgroundColor: "#131313",
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 132,
    gap: 24,
  },
  backgroundGlowLeft: {
    position: "absolute",
    top: -120,
    left: -120,
    width: 260,
    height: 260,
    borderRadius: 260,
    backgroundColor: "rgba(125, 255, 162, 0.06)",
  },
  backgroundGlowRight: {
    position: "absolute",
    top: 48,
    right: -120,
    width: 240,
    height: 240,
    borderRadius: 240,
    backgroundColor: "rgba(41, 121, 255, 0.05)",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  helloText: {
    color: "#ffffff",
    fontSize: fs(30),
    fontWeight: "700",
    letterSpacing: -0.6,
  },
  headerDivider: {
    marginTop: 10,
    width: 78,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  headerChip: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(58, 57, 57, 0.25)",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  headerChipText: {
    color: "#e5e2e1",
    fontSize: fs(10),
    letterSpacing: 2,
    fontWeight: "700",
  },
  balanceSection: {
    gap: 10,
  },
  sectionEyebrow: {
    color: "#c4c7c8",
    fontSize: fs(12),
    letterSpacing: 3,
    fontWeight: "700",
  },
  balanceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 8,
  },
  balanceValue: {
    color: "#ffffff",
    fontSize: fs(44),
    lineHeight: 48,
    fontWeight: "800",
    letterSpacing: -1.2,
    flexShrink: 1,
  },
  percentPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(58,57,57,0.3)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginLeft: 12,
  },
  percentArrow: {
    color: "#7dffa2",
    fontSize: fs(13),
    fontWeight: "700",
    fontFamily: "Material Symbols Outlined",
  },
  percentText: {
    fontSize: fs(12),
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  successText: {
    color: "#7dffa2",
  },
  dangerText: {
    color: "#ffb4ab",
  },
  mutedText: {
    color: "#c4c7c8",
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  metricCard: {
    flexBasis: "48%",
    flexGrow: 1,
    minWidth: "48%",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "#1c1b1b",
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  metricCardWide: {
    flexBasis: "100%",
    minWidth: "100%",
  },
  metricHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  metricLabel: {
    color: "#c4c7c8",
    fontSize: fs(11),
    letterSpacing: 2.4,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  metricIcon: {
    color: "#c4c7c8",
    fontSize: fs(16),
    fontWeight: "700",
    fontFamily: "Material Symbols Outlined",
  },
  metricValue: {
    color: "#ffffff",
    fontSize: fs(28),
    lineHeight: 30,
    fontWeight: "700",
    letterSpacing: -0.6,
  },
  metricNote: {
    fontSize: fs(13),
    lineHeight: 18,
    color: "#c4c7c8",
  },
  sectionHeadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  sectionTitle: {
    color: "#ffffff",
    fontSize: fs(22),
    lineHeight: 26,
    fontWeight: "700",
    letterSpacing: -0.4,
  },
  sectionIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#3a3939",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  actionPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(58,57,57,0.18)",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionLabel: {
    color: "#ffffff",
    fontSize: fs(10),
    fontWeight: "700",
    letterSpacing: 1.6,
  },
  actionArrow: {
    color: "#ffffff",
    fontSize: fs(14),
    fontWeight: "700",
  },
  carouselContent: {
    paddingRight: 24,
    gap: 16,
  },
  carouselItem: {
    flexGrow: 1,
  },
  carouselCard: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "#201f1f",
    borderRadius: 12,
    padding: 22,
    gap: 16,
    overflow: "hidden",
  },
  insightHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  insightIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(58,57,57,0.35)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    fontFamily: "Material Symbols Outlined",
    shadowColor: "#00ff00",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  carouselEyebrow: {
    color: "#c4c7c8",
    fontSize: fs(11),
    letterSpacing: 2.6,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  insightBody: {
    color: "#e5e2e1",
    fontSize: fs(16),
    lineHeight: 24,
  },
  paginationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: -4,
  },
  paginationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  paginationDotActive: {
    backgroundColor: "#7dffa2",
  },
  chartCard: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "#1c1b1b",
    borderRadius: 12,
    padding: 16,
    height: 320,
  },
  chartWrap: {
    gap: 12,
    overflow: "hidden",
  },
  chartLegendRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendDotSuccess: {
    backgroundColor: "#7dffa2",
  },
  legendDotMuted: {
    backgroundColor: "#3a3939",
  },
  legendText: {
    color: "#c4c7c8",
    fontSize: fs(11),
    letterSpacing: 1.2,
  },
  legendTrend: {
    color: "#c4c7c8",
    fontSize: fs(11),
    letterSpacing: 1.2,
  },
  chartArea: {
    position: "relative",
    flex: 1,
    paddingBottom: 10,
    overflow: "hidden",
  },
  chartPressTarget: {
    position: "relative",
  },
  chartSvg: {
    marginBottom: 6,
  },
  chartTooltip: {
    position: "absolute",
    top: 16,
    right: 8,
    minWidth: 132,
    maxWidth: 180,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(18, 18, 18, 0.92)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: "#000000",
    shadowOpacity: 0.32,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  chartTooltipLabel: {
    color: "#ffffff",
    fontSize: fs(12),
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  chartTooltipRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 6,
  },
  chartTooltipKeyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 1,
  },
  chartTooltipDotSuccess: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#7dffa2",
  },
  chartTooltipDotMuted: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#3a3939",
  },
  chartTooltipKey: {
    color: "#c4c7c8",
    fontSize: fs(11),
    letterSpacing: 0.7,
  },
  chartTooltipValue: {
    color: "#ffffff",
    fontSize: fs(11),
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  chartAxisRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 14,
  },
  chartAxisLabel: {
    width: 36,
    textAlign: "center",
    color: "#c4c7c8",
    fontSize: fs(10),
    letterSpacing: 1.1,
  },
  heatmapCard: {
    borderRadius: 12,
    minHeight: 220,
    gap: 8,
    padding: 8
  },
  heatmapGrid: {
    flexGrow: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6.5
  },
  heatmapDayLabel: {
    width: "12.28%",
    color: "#c4c7c8",
    fontSize: fs(8),
    textAlign: "center",
    marginBottom: 1,
  },
  heatmapCell: {
    width: "12.28%",
    height: "100%",
    aspectRatio: 1,
    borderRadius: 2.5,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.04)",
    backgroundColor: "#3a3939",
  },
  heatmapCellEmpty: {
    backgroundColor: "#2a2a2a",
  },
  heatmapLow: {
    backgroundColor: "rgba(125,255,162,0.16)",
  },
  heatmapMedLow: {
    backgroundColor: "rgba(125,255,162,0.28)",
  },
  heatmapMed: {
    backgroundColor: "rgba(125,255,162,0.45)",
  },
  heatmapHigh: {
    backgroundColor: "rgba(125,255,162,0.7)",
  },
  heatmapPeak: {
    backgroundColor: "#7dffa2",
  },
  heatmapCellSelected: {
    borderColor: "#7dffa2",
    borderWidth: 1.2,
    shadowColor: "#7dffa2",
    shadowOpacity: 0.16,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  legendFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.05)",
    paddingTop: 8,
    marginTop: -2,
  },
  legendHint: {
    color: "#c4c7c8",
    fontSize: fs(10),
    letterSpacing: 1,
  },
  legendSwatches: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendSwatch: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
  heatmapTooltip: {
    position: "absolute",
    top: 36,
    right: 8,
    minWidth: 132,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(18, 18, 18, 0.92)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: "#000000",
    shadowOpacity: 0.32,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  heatmapTooltipLabel: {
    color: "#ffffff",
    fontSize: fs(12),
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  categoryCard: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "#1c1b1b",
    borderRadius: 12,
    padding: 18,
    gap: 20,
  },
  ringWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
  },
  ringChart: {
    width: 190,
    height: 190,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  ringCenterText: {
    color: "#ffffff",
    fontSize: fs(18),
    fontWeight: "700",
    letterSpacing: -0.4,
  },
  ringCenterSubtext: {
    color: "#c4c7c8",
    fontSize: fs(10),
    letterSpacing: 1.6,
    marginTop: 4,
    textTransform: "uppercase",
  },
  ringCenterOverlay: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
    width: 146,
  },
  categoryTooltip: {
    marginTop: -2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(18, 18, 18, 0.92)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: "#000000",
    shadowOpacity: 0.32,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  categoryTooltipLabel: {
    color: "#c4c7c8",
    fontSize: fs(10),
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  categoryTooltipRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 6,
  },
  categoryTooltipName: {
    color: "#ffffff",
    fontSize: fs(14),
    fontWeight: "700",
  },
  categoryTooltipPercent: {
    color: "#7dffa2",
    fontSize: fs(12),
    fontWeight: "700",
  },
  categoryTooltipValue: {
    color: "#ffffff",
    fontSize: fs(18),
    fontWeight: "700",
    marginTop: 8,
  },
  categoryList: {
    gap: 12,
  },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  categoryRowSelected: {
    backgroundColor: "rgba(125,255,162,0.12)",
    borderRadius: 999,
  },
  categoryLabelWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  categoryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  categoryLabel: {
    color: "#ffffff",
    fontSize: fs(14),
  },
  categoryPercent: {
    color: "#c4c7c8",
    fontSize: fs(12),
    letterSpacing: 0.8,
  },
  patternCard: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "#1c1b1b",
    borderRadius: 12,
    padding: 18,
    gap: 16,
    minHeight: 305,
  },
  cardSubcopy: {
    marginTop: 4,
    color: "#c4c7c8",
    fontSize: fs(13),
    lineHeight: 19,
  },
  patternGrid: {
    flexDirection: "row",
    gap: 12,
  },
  patternStatBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "#201f1f",
    borderRadius: 8,
    padding: 14,
    gap: 8,
  },
  patternStatLabel: {
    color: "#c4c7c8",
    fontSize: fs(11),
    letterSpacing: 1.4,
  },
  patternStatValue: {
    color: "#ffffff",
    fontSize: fs(21),
    lineHeight: 26,
    fontWeight: "700",
  },
  patternCallout: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    backgroundColor: "rgba(58,57,57,0.18)",
    borderRadius: 8,
    padding: 14,
  },
  patternCalloutText: {
    color: "#c4c7c8",
    fontSize: fs(13),
    lineHeight: 19,
  },
  errorScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    backgroundColor: "#131313",
  },
  errorCard: {
    width: "100%",
    maxWidth: 420,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "#1c1b1b",
    borderRadius: 20,
    padding: 22,
    gap: 12,
  },
  errorEyebrow: {
    color: "#ffb4ab",
    fontSize: fs(11),
    letterSpacing: 2.4,
    fontWeight: "700",
  },
  errorTitle: {
    color: "#ffffff",
    fontSize: fs(22),
    lineHeight: 28,
    fontWeight: "700",
    letterSpacing: -0.4,
  },
  errorMessage: {
    color: "#c4c7c8",
    fontSize: fs(14),
    lineHeight: 20,
  },
  errorButton: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,180,171,0.32)",
    backgroundColor: "rgba(255,180,171,0.12)",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  errorButtonText: {
    color: "#ffb4ab",
    fontSize: fs(12),
    fontWeight: "700",
    letterSpacing: 1,
  },
  emptyScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    backgroundColor: "#131313",
  },
  emptyStateCard: {
    width: "100%",
    maxWidth: 420,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "#1c1b1b",
    borderRadius: 20,
    padding: 22,
    gap: 12,
  },
  emptyEyebrow: {
    color: "#c4c7c8",
    fontSize: fs(11),
    letterSpacing: 2.4,
    fontWeight: "700",
  },
  emptyTitle: {
    color: "#ffffff",
    fontSize: fs(22),
    lineHeight: 28,
    fontWeight: "700",
    letterSpacing: -0.4,
  },
  emptyMessage: {
    color: "#c4c7c8",
    fontSize: fs(14),
    lineHeight: 20,
  },
  emptyButton: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(125,255,162,0.32)",
    backgroundColor: "rgba(125,255,162,0.12)",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  emptyButtonText: {
    color: "#7dffa2",
    fontSize: fs(12),
    fontWeight: "700",
    letterSpacing: 1,
  },
  emptyPanel: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(58,57,57,0.16)",
    borderRadius: 14,
    padding: 16,
    gap: 8,
    justifyContent: "center",
  },
  emptyPanelTitle: {
    color: "#ffffff",
    fontSize: fs(16),
    lineHeight: 20,
    fontWeight: "700",
  },
  emptyPanelMessage: {
    color: "#c4c7c8",
    fontSize: fs(13),
    lineHeight: 19,
  },
  successInline: {
    color: "#7dffa2",
    fontWeight: "700",
  },
  inlineDelta: {
    fontSize: fs(12),
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  loadingOverlay: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingTop: 12,
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: "#131313",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loadingText: {
    color: "#c4c7c8",
    fontSize: fs(12),
  },
});
