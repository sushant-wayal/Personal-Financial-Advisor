import React from "react";
import { View, Text, StyleSheet, Modal, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { Skeleton } from "./LoadingSkeleton";

const fs = (size: number) => Math.round(size * 0.9 * 10) / 10;

export function ConfirmModal({
  visible,
  title,
  description,
  confirmText = "Delete",
  cancelText = "Go Back",
  loading = false,
  error = null,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  description: string | React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  loading?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <SafeAreaView style={styles.confirmOverlay} edges={["top", "bottom"]}>
        <View style={styles.confirmCard}>
          <View style={styles.confirmIcon}>
            <MaterialIcons name="delete-outline" size={26} color="#ffb4ab" />
          </View>
          <Text style={styles.confirmTitle}>{title}</Text>
          <Text style={styles.confirmBody}>{description}</Text>
          {error ? <Text style={styles.confirmErrorText}>{error}</Text> : null}
          <View style={styles.confirmActions}>
            <Pressable
              disabled={loading}
              style={({ pressed }) => [styles.confirmCancel, pressed ? { opacity: 0.85 } : null]}
              onPress={onCancel}
            >
              <Text style={styles.confirmCancelText}>{cancelText}</Text>
            </Pressable>
            <Pressable
              disabled={loading}
              style={({ pressed }) => [styles.confirmDelete, loading ? { opacity: 0.7 } : null, pressed ? { opacity: 0.85 } : null]}
              onPress={onConfirm}
            >
              {loading ? <Skeleton width={56} height={14} radius={7} /> : <Text style={styles.confirmDeleteText}>{confirmText}</Text>}
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  confirmOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.74)", alignItems: "center", justifyContent: "center", padding: 24 },
  confirmCard: { width: "100%", borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", backgroundColor: "#131313", padding: 24, gap: 14 },
  confirmIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: "rgba(255,180,171,0.08)", alignItems: "center", justifyContent: "center" },
  confirmTitle: { color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: fs(24), lineHeight: 32, fontWeight: "700" },
  confirmBody: { color: "#c4c7c8", fontFamily: "Inter", fontSize: fs(16), lineHeight: 24 },
  confirmErrorText: { color: "#ffb4ab", fontFamily: "Inter", fontSize: fs(13), lineHeight: 19 },
  confirmActions: { flexDirection: "row", gap: 14, paddingTop: 8 },
  confirmCancel: { flex: 1, height: 52, borderRadius: 999, borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", alignItems: "center", justifyContent: "center" },
  confirmDelete: { flex: 1, height: 52, borderRadius: 999, backgroundColor: "#ffb4ab", alignItems: "center", justifyContent: "center" },
  confirmCancelText: { color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: fs(14), fontWeight: "700", letterSpacing: 1.6, textTransform: "uppercase" },
  confirmDeleteText: { color: "#690005", fontFamily: "Hanken Grotesk", fontSize: fs(14), fontWeight: "700", letterSpacing: 1.6, textTransform: "uppercase" },
});
