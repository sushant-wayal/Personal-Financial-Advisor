import React, { useState } from "react";
import {
  Pressable,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { API_BASE_URL } from "../lib/apiBaseUrl";

function apiUrl(path: string) {
  return `${API_BASE_URL}${path}`;
}

const fs = (size: number) => Math.round(size * 0.9 * 10) / 10;

export default function ExportSettingsScreen() {
  const router = useRouter();
  const [exportStatus, setExportStatus] = useState<"idle" | "exporting" | "done" | "error">("idle");
  const [exportStepText, setExportStepText] = useState("Gathering accounts...");
  const [error, setError] = useState<string | null>(null);

  async function exportContext() {
    setExportStatus("exporting");
    setError(null);
    const steps = [
      "Gathering accounts...",
      "Analyzing transactions...",
      "Calculating net worth...",
      "Structuring goals & budgets...",
      "Writing Markdown file...",
    ];
    let stepIdx = 0;
    setExportStepText(steps[0]);

    const interval = setInterval(() => {
      stepIdx = (stepIdx + 1) % steps.length;
      setExportStepText(steps[stepIdx]);
    }, 350);

    try {
      const res = await fetch(apiUrl("/api/export-context"));
      const data = await res.json();
      clearInterval(interval);

      if (!res.ok || !data.ok) {
        setExportStatus("error");
        setError(data?.error || "Failed to export context.");
        return;
      }

      const fileName = data.filename || `financial-context-${Date.now()}.md`;
      const fileUri = `${FileSystem.cacheDirectory}${fileName}`;

      await FileSystem.writeAsStringAsync(fileUri, data.content, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: "text/markdown",
          dialogTitle: "Export Financial Context",
          UTI: "public.plain-text",
        });
      } else {
        await Share.share({
          url: fileUri,
          title: fileName,
          message: data.content,
        });
      }

      setExportStatus("done");
      setTimeout(() => setExportStatus("idle"), 3000);
    } catch (err: any) {
      clearInterval(interval);
      setExportStatus("error");
      setError(err?.message || "Export failed.");
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor="#131313" />

      {/* Top Bar Navigation */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="chevron-left" size={24} color="#ffffff" />
          <Text style={styles.backButtonText}>PROFILE</Text>
        </Pressable>
      </View>

      <KeyboardAwareScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerBlock}>
          <Text style={styles.eyebrow}>External LLM Export</Text>
          <Text style={styles.screenTitle}>Financial Context</Text>
          <Text style={styles.screenSub}>
            Generate a comprehensive Markdown summary of your net worth, goals, transactions, and budgets for external AI analysis.
          </Text>
        </View>

        <View style={styles.panelCard}>
          <View style={styles.cardHeader}>
            <View style={styles.iconAvatar}>
              <MaterialIcons name="description" size={24} color="#818cf8" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Markdown Snapshot Export</Text>
              <Text style={styles.sectionSubtext}>
                Creates a privacy-safe, structured text file ready to copy/share to ChatGPT, Claude, or Gemini.
              </Text>
            </View>
          </View>

          {exportStatus === "exporting" && (
            <View style={styles.statusBox}>
              <MaterialIcons name="sync" size={20} color="#818cf8" />
              <Text style={styles.statusText}>{exportStepText}</Text>
            </View>
          )}

          {exportStatus === "done" && (
            <View style={[styles.statusBox, { borderColor: "rgba(52,211,153,0.4)", backgroundColor: "rgba(52,211,153,0.1)" }]}>
              <MaterialIcons name="check-circle" size={20} color="#34d399" />
              <Text style={[styles.statusText, { color: "#34d399" }]}>Financial Context Exported Successfully!</Text>
            </View>
          )}

          {error && (
            <View style={[styles.statusBox, { borderColor: "rgba(239,68,68,0.4)", backgroundColor: "rgba(239,68,68,0.1)" }]}>
              <MaterialIcons name="error" size={20} color="#ef4444" />
              <Text style={[styles.statusText, { color: "#ef4444" }]}>{error}</Text>
            </View>
          )}

          <Pressable
            onPress={exportContext}
            disabled={exportStatus === "exporting"}
            style={[styles.exportBtn, exportStatus === "exporting" && styles.exportBtnDisabled]}
          >
            <MaterialIcons name="file-download" size={20} color="#ffffff" />
            <Text style={styles.exportBtnText}>
              {exportStatus === "exporting" ? "Generating Context..." : "Export Financial Context Markdown"}
            </Text>
          </Pressable>
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#131313" },
  topBar: {
    height: 80,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(68,71,72,0.20)",
    backgroundColor: "rgba(19,19,19,0.94)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: { flexDirection: "row", alignItems: "center", gap: 4 },
  backButtonText: { color: "#ffffff", fontFamily: "JetBrains Mono", fontSize: fs(11), letterSpacing: 1.4, fontWeight: "700" },
  scroll: { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 160, gap: 24 },
  headerBlock: { gap: 6 },
  eyebrow: { color: "#c4c7c8", fontFamily: "JetBrains Mono", fontSize: fs(10), letterSpacing: 1.6, textTransform: "uppercase", fontWeight: "700" },
  screenTitle: { color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: fs(30), lineHeight: 38, fontWeight: "700" },
  screenSub: { color: "#8e9192", fontFamily: "Inter", fontSize: fs(13), lineHeight: 19 },
  panelCard: { borderRadius: 16, borderWidth: 1, borderColor: "rgba(68,71,72,0.35)", backgroundColor: "#0e0e0e", padding: 22, gap: 18 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 14 },
  iconAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(129,140,248,0.15)", alignItems: "center", justifyContent: "center" },
  sectionTitle: { color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: fs(18), fontWeight: "700" },
  sectionSubtext: { color: "#8e9192", fontFamily: "Inter", fontSize: fs(12), marginTop: 2, lineHeight: 17 },
  statusBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(129,140,248,0.3)",
    backgroundColor: "rgba(129,140,248,0.08)",
    padding: 14,
  },
  statusText: { color: "#818cf8", fontFamily: "Inter", fontSize: fs(13), fontWeight: "600" },
  exportBtn: {
    height: 52,
    borderRadius: 14,
    backgroundColor: "#818cf8",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  exportBtnDisabled: { opacity: 0.5 },
  exportBtnText: { color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: fs(15), fontWeight: "700" },
});
