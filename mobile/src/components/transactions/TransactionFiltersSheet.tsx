import React from "react";
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableWithoutFeedback, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

type SheetName = "advanced" | "time" | "category" | "type" | null;

type TransactionFiltersSheetProps = {
  activeSheet: SheetName;
  closeSheet: () => void;
  sheetTranslateY: Animated.AnimatedInterpolation<number>;
  filterSearch: string;
  setFilterSearch: (val: string) => void;
  filterMerchant: string;
  setFilterMerchant: (val: string) => void;
  filterMin: string;
  setFilterMin: (val: string) => void;
  filterMax: string;
  setFilterMax: (val: string) => void;
  currencySymbol: string;
  onClear: () => void;
  onApply: () => void;
};

export function TransactionFiltersSheet({
  activeSheet,
  closeSheet,
  sheetTranslateY,
  filterSearch,
  setFilterSearch,
  filterMerchant,
  setFilterMerchant,
  filterMin,
  setFilterMin,
  filterMax,
  setFilterMax,
  currencySymbol,
  onClear,
  onApply,
}: TransactionFiltersSheetProps) {
  if (!activeSheet) return null;

  return (
    <Modal visible={Boolean(activeSheet)} transparent animationType="none" onRequestClose={closeSheet}>
      <View style={styles.sheetOverlay}>
        <TouchableWithoutFeedback onPress={closeSheet}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>
        <Animated.View style={[styles.sheetContainer, { transform: [{ translateY: sheetTranslateY }] }]}>
          <View style={styles.advancedHeader}>
            <Text style={styles.sheetTitle}>Filters</Text>
            <Pressable onPress={closeSheet}>
              <MaterialIcons name="close" size={22} color="#c4c7c8" />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.body}>
            <View style={styles.field}>
              <Text style={styles.label}>Global Search</Text>
              <TextInput value={filterSearch} onChangeText={setFilterSearch} placeholder="Search keyword" placeholderTextColor="#8e9192" style={styles.input} />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Merchant</Text>
              <TextInput value={filterMerchant} onChangeText={setFilterMerchant} placeholder="Merchant name" placeholderTextColor="#8e9192" style={styles.input} />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Amount ({currencySymbol})</Text>
              <View style={styles.row}>
                <TextInput value={filterMin} onChangeText={setFilterMin} placeholder="Min" keyboardType="numeric" style={[styles.input, styles.half]} />
                <TextInput value={filterMax} onChangeText={setFilterMax} placeholder="Max" keyboardType="numeric" style={[styles.input, styles.half]} />
              </View>
            </View>
          </ScrollView>
          <View style={styles.footer}>
            <Pressable style={styles.btnSecondary} onPress={onClear}><Text style={styles.btnSecondaryText}>Clear</Text></Pressable>
            <Pressable style={styles.btnPrimary} onPress={onApply}><Text style={styles.btnPrimaryText}>Apply</Text></Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheetOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheetContainer: { backgroundColor: "#1c1b1f", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: "80%" },
  advancedHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  sheetTitle: { fontSize: 20, fontWeight: "700", color: "#ffffff" },
  body: { gap: 16 },
  field: { gap: 6 },
  label: { fontSize: 13, color: "#c4c7c8", fontWeight: "600" },
  input: { backgroundColor: "#2b2930", color: "#ffffff", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14 },
  row: { flexDirection: "row", gap: 10 },
  half: { flex: 1 },
  footer: { flexDirection: "row", gap: 12, marginTop: 20 },
  btnSecondary: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: "#2b2930", alignItems: "center" },
  btnSecondaryText: { color: "#ffffff", fontWeight: "600" },
  btnPrimary: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: "#d0bcff", alignItems: "center" },
  btnPrimaryText: { color: "#381e72", fontWeight: "700" },
});
