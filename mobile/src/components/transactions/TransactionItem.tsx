import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import type { Transaction } from "../../types/transaction";

type TransactionItemProps = {
  item: Transaction;
  clubMode: boolean;
  selected: boolean;
  currencySymbol: string;
  isCredit: boolean;
  dateStr: string;
  onPress: () => void;
  onLongPress: () => void;
};

export function TransactionItem({
  item,
  clubMode,
  selected,
  currencySymbol,
  isCredit,
  dateStr,
  onPress,
  onLongPress,
}: TransactionItemProps) {
  const merchant = item.merchant ?? "Unknown";
  const category = item.category?.name ?? "";
  const method = item.paymentMethod ?? item.transactionType ?? "";
  const bank = item.bankName ?? "";

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      android_ripple={{ color: "rgba(255,255,255,0.025)" }}
      style={({ pressed }) => [styles.row, selected ? styles.rowSelected : null, pressed ? styles.rowPressed : null]}
    >
      {clubMode ? (
        <View style={[styles.clubCheckbox, selected ? styles.clubCheckboxSelected : null]}>
          {selected ? <MaterialIcons name="check" size={16} color="#131313" /> : null}
        </View>
      ) : null}
      <View style={styles.rowCopy}>
        <View style={styles.rowTop}>
          <View style={styles.rowTitleGroup}>
            <Text style={styles.merchant} numberOfLines={1}>{merchant}</Text>
            <Text style={styles.date}>{dateStr}</Text>
          </View>
          <Text style={[styles.amount, isCredit ? styles.credit : styles.debit]} numberOfLines={1}>
            {isCredit ? "+" : "-"}{currencySymbol}{Math.abs(item.amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
        </View>

        <View style={styles.metaRow}>
          {item.isClubbed ? (
            <View style={styles.clubbedBadge}>
              <MaterialIcons name="call-merge" size={13} color="#d0bcff" />
              <Text style={styles.clubbedBadgeText}>CLUBBED</Text>
            </View>
          ) : null}
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
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#131313",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rowSelected: {
    backgroundColor: "#1f1d2b",
  },
  rowPressed: {
    backgroundColor: "#1b1b1b",
  },
  rowCopy: {
    flex: 1,
  },
  rowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  rowTitleGroup: {
    flex: 1,
  },
  merchant: {
    fontSize: 15,
    fontWeight: "600",
    color: "#ffffff",
    letterSpacing: -0.2,
  },
  date: {
    fontSize: 12,
    color: "#8e9192",
    marginTop: 2,
  },
  amount: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  debit: {
    color: "#ffb4ab",
  },
  credit: {
    color: "#80e3ab",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: 6,
    gap: 6,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaDot: {
    color: "#444748",
    fontSize: 10,
  },
  metaText: {
    fontSize: 12,
    color: "#c4c7c8",
  },
  clubbedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(208, 188, 255, 0.12)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  clubbedBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#d0bcff",
    letterSpacing: 0.5,
  },
  clubCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#444748",
    alignItems: "center",
    justifyContent: "center",
  },
  clubCheckboxSelected: {
    backgroundColor: "#d0bcff",
    borderColor: "#d0bcff",
  },
});
