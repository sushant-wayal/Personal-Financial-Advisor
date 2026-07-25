import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Alert,
  Animated,
  TouchableWithoutFeedback,
  Modal,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { API_BASE_URL } from "../../lib/apiBaseUrl";
import { useCurrency, formatCurrencyAmount, formatIndianAmountInput, parseIndianAmountInput } from "../../providers/CurrencyProvider";
import { beginHorizontalScroll, endHorizontalScroll } from "../../lib/horizontalScrollPriority";
import { ConfirmModal } from "../ConfirmModal";
import { BudgetsSkeleton } from "../LoadingSkeleton";

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

function fs(size: number) {
  return Math.round(size * 0.9 * 10) / 10;
}

function CustomSwitch({ value, onValueChange }: { value: boolean; onValueChange: (v: boolean) => void }) {
  const [animValue] = useState(() => new Animated.Value(value ? 1 : 0));

  useEffect(() => {
    Animated.timing(animValue, {
      toValue: value ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [value]);

  const translateX = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [2, 22],
  });

  const trackBg = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(255,255,255,0.06)", "rgba(125,255,162,0.15)"],
  });

  const trackBorder = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(255,255,255,0.12)", "rgba(125,255,162,0.5)"],
  });

  const thumbColor = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: ["#8e9192", "#7dffa2"],
  });

  return (
    <Pressable onPress={() => onValueChange(!value)} style={styles.customSwitchContainer}>
      <Animated.View style={[styles.switchTrack, { backgroundColor: trackBg, borderColor: trackBorder }]}>
        <Animated.View style={[styles.switchThumb, { transform: [{ translateX }], backgroundColor: thumbColor }]} />
      </Animated.View>
    </Pressable>
  );
}

export function BudgetsView() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const { currencyCode } = useCurrency();

  // Bottom Sheet Animation
  const [sheetAnim] = useState(() => new Animated.Value(0));
  const sheetTranslateY = sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [600, 0] });

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [limit, setLimit] = useState("");
  const [rollover, setRollover] = useState(false);

  const fetchBudgets = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/budgets`);
      const data = await res.json();
      if (data.ok) {
        setBudgets(data.budgets);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/categories`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setCategories(data);
      } else if (data.ok && data.categories) {
        setCategories(data.categories);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  const initData = useCallback(async () => {
    await Promise.all([fetchBudgets(), fetchCategories()]);
    setLoading(false);
  }, [fetchBudgets, fetchCategories]);

  useEffect(() => {
    void initData();
  }, [initData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await initData();
    setRefreshing(false);
  };

  const openSheet = () => {
    setModalVisible(true);
    Animated.timing(sheetAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  };

  const closeSheet = () => {
    Animated.timing(sheetAnim, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => setModalVisible(false));
  };

  const openNewBudget = () => {
    setEditingId(null);
    setSelectedCategory(categories[0]?.id || "");
    setLimit("");
    setRollover(false);
    openSheet();
  };

  const openEditBudget = (budget: Budget) => {
    setEditingId(budget.id);
    setSelectedCategory(budget.categoryId);
    setLimit(budget.monthlyLimit.toString());
    setRollover(budget.rollover);
    openSheet();
  };

  const saveBudget = async () => {
    if (!limit || !selectedCategory) return;
    try {
      const url = editingId ? `${API_BASE_URL}/api/budgets/${editingId}` : `${API_BASE_URL}/api/budgets`;
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: selectedCategory,
          monthlyLimit: parseFloat(limit),
          rollover,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        closeSheet();
        await onRefresh();
      } else {
        Alert.alert("Error", data.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const confirmDelete = () => {
    setDeleteConfirmVisible(true);
  };

  const deleteBudget = async () => {
    if (!editingId) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/budgets/${editingId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.ok) {
        closeSheet();
        await onRefresh();
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return <BudgetsSkeleton />;
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor="#ffffff" />}
      >
        <View style={styles.headerRow}>
          <Text style={styles.title}>Category Budgets</Text>
          <Pressable style={styles.actionPill} onPress={openNewBudget}>
            <Text style={styles.actionLabel}>New</Text>
            <Text style={styles.actionArrow}>→</Text>
          </Pressable>
        </View>

        {budgets.length === 0 ? (
          <Text style={styles.emptyText}>No budgets set. Create one to track your spending!</Text>
        ) : (
          budgets.map((b) => {
            const progress = Math.min(1, b.spent / b.totalLimit);
            const isWarning = progress > 0.8;
            const isDanger = progress >= 1;
            const progressColor = isDanger ? "#ff5252" : isWarning ? "#ffb4ab" : "#7dffa2";

            return (
              <Pressable key={b.id} style={styles.metricCard} onPress={() => openEditBudget(b)}>
                <View style={styles.cardHeader}>
                  <Text style={styles.categoryName}>{b.category?.name || "Unknown"}</Text>
                  {b.rollover && (
                    <View style={styles.rolloverBadge}>
                      <MaterialIcons name="autorenew" size={12} color="#7dffa2" />
                      <Text style={styles.rolloverText}>Rollover</Text>
                    </View>
                  )}
                </View>

                <View style={styles.amountsRow}>
                  <View>
                    <Text style={styles.amountLabel}>Spent</Text>
                    <Text style={[styles.amountValue, { color: progressColor }]}>
                      {formatCurrencyAmount(b.spent, currencyCode)}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={styles.amountLabel}>Limit</Text>
                    <Text style={styles.amountValue}>
                      {formatCurrencyAmount(b.totalLimit, currencyCode)}
                    </Text>
                  </View>
                </View>

                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: progressColor }]} />
                </View>
                
                <Text style={styles.availableText}>
                  Available{b.rollover ? " (including rollover)" : ""}: {formatCurrencyAmount(b.available, currencyCode)}
                </Text>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      {modalVisible && (
        <Modal visible={modalVisible} transparent animationType="none" onRequestClose={closeSheet}>
          <View style={styles.sheetOverlayWrap}>
            <TouchableWithoutFeedback onPress={closeSheet}>
              <Animated.View style={[styles.sheetBackdrop, { opacity: sheetAnim }]} />
            </TouchableWithoutFeedback>
            <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetTranslateY }] }]}>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>{editingId ? "Edit Budget" : "New Budget"}</Text>
              </View>

              <View style={styles.sheetBody}>
                  <Text style={styles.label}>Category</Text>
                  <ScrollView 
                    style={styles.categoryScroll} 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    onTouchStart={beginHorizontalScroll}
                    onTouchEnd={endHorizontalScroll}
                    onTouchCancel={endHorizontalScroll}
                  >
                    {categories.map((c) => (
                      <Pressable
                        key={c.id}
                        style={[styles.sheetOption, selectedCategory === c.id && styles.sheetOptionSelected]}
                        onPress={() => setSelectedCategory(c.id)}
                      >
                        <Text style={[styles.sheetOptionText, selectedCategory === c.id && styles.sheetOptionTextSelected]}>{c.name}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>

                  <Text style={styles.label}>Monthly Limit</Text>
                  <TextInput
                    style={styles.plainInput}
                    value={formatIndianAmountInput(limit)}
                    onChangeText={(t) => setLimit(parseIndianAmountInput(t))}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="#8e9192"
                  />

                  <View style={styles.switchRow}>
                    <View>
                      <Text style={styles.label}>Rollover</Text>
                      <Text style={styles.subLabel}>Carry unspent limit to next month</Text>
                    </View>
                    <CustomSwitch
                      value={rollover}
                      onValueChange={setRollover}
                    />
                  </View>

                  <View style={styles.sheetActions}>
                    {editingId && (
                      <Pressable style={styles.sheetDeleteButton} onPress={confirmDelete}>
                        <MaterialIcons name="delete" size={22} color="#ffb4ab" />
                      </Pressable>
                    )}
                    <Pressable style={styles.sheetCancelButton} onPress={closeSheet}>
                      <Text style={styles.sheetCancelText}>CANCEL</Text>
                    </Pressable>
                    <Pressable style={styles.sheetPrimaryButton} onPress={() => void saveBudget()}>
                      <Text style={styles.sheetPrimaryText}>{editingId ? "SAVE" : "CREATE"}</Text>
                    </Pressable>
                  </View>
              </View>
            </Animated.View>
          </View>
        </Modal>
      )}

      <ConfirmModal
        visible={deleteConfirmVisible}
        title="Delete Budget"
        description="Are you sure you want to delete this budget? This action cannot be undone."
        onCancel={() => setDeleteConfirmVisible(false)}
        onConfirm={() => { setDeleteConfirmVisible(false); void deleteBudget(); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#131313" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  scrollContent: { padding: 24, paddingBottom: 120, gap: 16 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { color: "#fff", fontFamily: "Hanken Grotesk", fontSize: fs(18), fontWeight: "700" },
  
  actionPill: {
    height: 38,
    paddingHorizontal: 16,
    borderRadius: 19,
    backgroundColor: "#201f1f",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionLabel: { color: "#c4c7c8", fontFamily: "JetBrains Mono", fontSize: fs(12), letterSpacing: 0.8, textTransform: "uppercase" },
  actionArrow: { color: "#7dffa2", fontSize: fs(16), fontWeight: "700", marginTop: -2 },

  emptyText: { color: "#8e9192", fontFamily: "Inter", fontSize: fs(14), textAlign: "center", marginTop: 40 },
  
  metricCard: {
    backgroundColor: "#101010",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    borderRadius: 14,
    padding: 20,
    gap: 16,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  categoryName: { color: "#fff", fontFamily: "Hanken Grotesk", fontSize: fs(18), fontWeight: "600" },
  rolloverBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(125,255,162,0.12)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  rolloverText: { color: "#7dffa2", fontFamily: "JetBrains Mono", fontSize: fs(10), fontWeight: "700", textTransform: "uppercase" },
  amountsRow: { flexDirection: "row", justifyContent: "space-between" },
  amountLabel: { color: "#8e9192", fontFamily: "JetBrains Mono", fontSize: fs(11), textTransform: "uppercase", marginBottom: 4, letterSpacing: 1 },
  amountValue: { color: "#fff", fontFamily: "Hanken Grotesk", fontSize: fs(24), fontWeight: "700" },
  progressTrack: { height: 6, backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3 },
  availableText: { color: "#8e9192", fontFamily: "Inter", fontSize: fs(13), marginTop: 2 },
  
  sheetOverlayWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    zIndex: 100,
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  sheet: {
    backgroundColor: "#131313",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    paddingTop: 24,
    paddingBottom: 20,
  },
  sheetHeader: {
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  sheetTitle: { color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: fs(24), lineHeight: 32, fontWeight: "600" },
  sheetBody: {
    paddingHorizontal: 24,
    gap: 16,
  },
  label: { color: "#8e9192", fontFamily: "JetBrains Mono", fontSize: fs(12), letterSpacing: 0.8, textTransform: "uppercase" },
  subLabel: { color: "#8e9192", fontFamily: "Inter", fontSize: fs(13), marginTop: 4 },
  categoryScroll: { flexDirection: "row", marginBottom: 8, marginHorizontal: -24, paddingHorizontal: 24 },
  
  sheetOption: { height: 38, paddingHorizontal: 16, borderRadius: 19, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center", backgroundColor: "#1A1A1A", marginRight: 8 },
  sheetOptionSelected: { backgroundColor: "#ffffff", borderColor: "#ffffff" },
  sheetOptionText: { color: "#e5e2e1", fontFamily: "Inter", fontSize: fs(14), fontWeight: "500" },
  sheetOptionTextSelected: { color: "#131313", fontWeight: "700" },
  
  plainInput: { height: 54, borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", backgroundColor: "#1A1A1A", color: "#ffffff", paddingHorizontal: 16, fontFamily: "Inter", fontSize: fs(16) },
  switchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
  customSwitchContainer: { padding: 4 },
  switchTrack: { width: 44, height: 24, borderRadius: 12, borderWidth: 1, justifyContent: "center" },
  switchThumb: { width: 18, height: 18, borderRadius: 9, position: "absolute" },
  sheetActions: { flexDirection: "row", gap: 16, marginTop: 24, paddingTop: 24, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.10)" },
  
  sheetPrimaryButton: { flex: 1, height: 56, borderRadius: 999, backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center" },
  sheetPrimaryText: { color: "#000000", fontFamily: "Hanken Grotesk", fontSize: fs(14), letterSpacing: 2.1, fontWeight: "700", textTransform: "uppercase" },
  sheetCancelButton: { flex: 1, height: 56, borderRadius: 999, borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", backgroundColor: "rgba(255,255,255,0.05)", alignItems: "center", justifyContent: "center" },
  sheetCancelText: { color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: fs(14), letterSpacing: 2.1, fontWeight: "700", textTransform: "uppercase" },
  sheetDeleteButton: { width: 56, height: 56, borderRadius: 28, borderWidth: 1, borderColor: "rgba(255,180,171,0.24)", backgroundColor: "rgba(255,180,171,0.10)", alignItems: "center", justifyContent: "center" },
});
