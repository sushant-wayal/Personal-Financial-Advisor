import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator, Animated, Modal, StatusBar } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { MaterialIcons } from "@expo/vector-icons";
import { NETWORTH_CONFIG, FieldConfig } from "../../lib/networthConfig";
import { fetchNetWorth, createNetWorth, updateNetWorth, deleteNetWorth, NetWorthData } from "../../lib/networthApi";
import { DatePickerModal, fullDateLabel } from "../../components/DatePickerModal";
import { formatIndianAmountInput, parseIndianAmountInput } from "../../providers/CurrencyProvider";
import { ConfirmModal } from "../../components/ConfirmModal";
import { useAlert } from "../../providers/AlertProvider";

function CustomSwitch({ value, onValueChange }: { value: boolean; onValueChange: (v: boolean) => void }) {
  const [animValue] = useState(() => new Animated.Value(value ? 1 : 0));

  useEffect(() => {
    Animated.timing(animValue, {
      toValue: value ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [value, animValue]);

  const translateX = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [2, 22],
  });

  const trackBg = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(255,255,255,0.06)", "rgba(5,231,119,0.15)"],
  });

  const trackBorder = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(255,255,255,0.12)", "rgba(5,231,119,0.5)"],
  });

  const thumbColor = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: ["#8e9192", "#05e777"],
  });

  return (
    <Pressable onPress={() => onValueChange(!value)} style={styles.customSwitchContainer}>
      <Animated.View style={[styles.switchTrack, { backgroundColor: trackBg, borderColor: trackBorder }]}>
        <Animated.View style={[styles.switchThumb, { transform: [{ translateX }], backgroundColor: thumbColor }]} />
      </Animated.View>
    </Pressable>
  );
}

export default function NetWorthFormScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const type = params.type as string;
  const id = params.id as string | undefined;

  const config = NETWORTH_CONFIG[type];
  const [networthData, setNetworthData] = useState<NetWorthData | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [datePickerField, setDatePickerField] = useState<string | null>(null);
  
  const [pulseAnim] = useState(() => new Animated.Value(1));
  const { showWarning, showError } = useAlert();

  useEffect(() => {
    if (loading) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.4, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true })
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [loading, pulseAnim]);

  useEffect(() => {
    if (id) {
      fetchNetWorth().then(setData => setNetworthData(setData)).catch(console.error);
    }
  }, [id]);

  useEffect(() => {
    if (id && networthData && config) {
      // Find the existing item
      const category = config.category === "asset" ? "assets" : "liabilities";
      const items = (networthData as any)[category]?.[type] || [];
      const item = items.find((i: any) => i.id === id);
      if (item) {
        // Parse dates into YYYY-MM-DD for the form if they are strings
        const initForm = { ...item };
        config.fields.forEach(f => {
           if (f.type === "date" && initForm[f.name]) {
             initForm[f.name] = new Date(initForm[f.name]).toISOString().split('T')[0];
           }
        });
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setForm(initForm);
      }
    }
  }, [id, networthData, config, type]);

  if (!config) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>Invalid configuration type</Text>
      </SafeAreaView>
    );
  }

  const handleChange = (name: string, value: any) => {
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      // Prepare payload (convert strings to numbers where needed)
      const payload: Record<string, any> = {};
      
      for (const field of config.fields) {
        let val = form[field.name];
        
        if (val === undefined || val === "") {
          if (field.required) {
            showWarning("Missing Field", `${field.label} is required.`);
            setLoading(false);
            return;
          }
          continue;
        }

        if (field.type === "number") {
          val = Number(val);
        } else if (field.type === "date") {
          val = new Date(val).toISOString();
        }

        payload[field.name] = val;
      }

      if (id) {
        await updateNetWorth(type, id, payload);
      } else {
        await createNetWorth(type, payload);
      }
      
      router.back();
    } catch (e: any) {
      showError("Error", e.message || "Failed to save");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    setDeleteConfirmVisible(true);
  };

  const confirmDelete = async () => {
    setLoading(true);
    try {
      await deleteNetWorth(type, id!);
      setDeleteConfirmVisible(false);
      router.back();
    } catch (e: any) {
      showError("Error", e.message || "Failed to delete");
      setDeleteConfirmVisible(false);
    } finally {
      setLoading(false);
    }
  };

  const renderField = (field: FieldConfig) => {
    const value = form[field.name];

    if (field.type === "boolean") {
      return (
        <View key={field.name} style={styles.switchRow}>
          <View style={{ flex: 1, paddingRight: 16 }}>
            <Text style={[styles.label, field.description ? { marginBottom: 4 } : {}]}>{field.label} {field.required && "*"}</Text>
            {field.description && <Text style={styles.description}>{field.description}</Text>}
          </View>
          <CustomSwitch 
            value={!!value}
            onValueChange={(v) => handleChange(field.name, v)}
          />
        </View>
      );
    }

    if (field.type === "select") {
      return (
        <View key={field.name} style={styles.fieldBlock}>
          <Text style={[styles.label, field.description ? { marginBottom: 4 } : {}]}>{field.label} {field.required && "*"}</Text>
          {field.description && <Text style={styles.description}>{field.description}</Text>}
          <View style={styles.optionsRow}>
            {field.options?.map(opt => (
              <Pressable
                key={opt.value}
                style={[styles.optionPill, value === opt.value && styles.optionPillActive]}
                onPress={() => handleChange(field.name, opt.value)}
              >
                <Text style={[styles.optionText, value === opt.value && styles.optionTextActive]}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      );
    }

    if (field.type === "date") {
      return (
        <View key={field.name} style={styles.fieldBlock}>
          <Text style={[styles.label, field.description ? { marginBottom: 4 } : {}]}>{field.label} {field.required && "*"}</Text>
          {field.description && <Text style={styles.description}>{field.description}</Text>}
          <Pressable style={styles.dateInputWrap} onPress={() => setDatePickerField(field.name)}>
            <Text style={[styles.dateInputText, !value ? { color: "rgba(255,255,255,0.3)" } : null]}>
              {value ? fullDateLabel(String(value)) : "Select date"}
            </Text>
            <MaterialIcons name="calendar-today" size={20} color="#8e9192" />
          </Pressable>
        </View>
      );
    }

    return (
      <View key={field.name} style={styles.fieldBlock}>
        <Text style={[styles.label, field.description ? { marginBottom: 4 } : {}]}>{field.label} {field.required && "*"}</Text>
        {field.description && <Text style={styles.description}>{field.description}</Text>}
        <TextInput
          style={styles.input}
          value={field.type === "number" ? formatIndianAmountInput(value !== undefined ? String(value) : "") : (value !== undefined ? String(value) : "")}
          onChangeText={(text) => handleChange(field.name, field.type === "number" ? parseIndianAmountInput(text) : text)}
          placeholder={field.type === "number" ? "0" : "Enter value"}
          placeholderTextColor="rgba(255,255,255,0.3)"
          keyboardType={field.type === "number" ? "numeric" : "default"}
        />
      </View>
    );
  };

  const renderLoadingOverlay = () => {
    const isPredictable = ["vehicleAsset", "plotAsset", "independentPropertyAsset", "apartmentAsset", "mutualFund", "stock", "jewelleryAsset"].includes(type);
    const title = isPredictable ? "Evaluating Asset" : "Saving Details";
    const desc = isPredictable 
      ? "Our AI is currently crunching market data to accurately predict the current worth of your asset..." 
      : "Securely saving your details...";

    return (
      <Modal visible={loading} transparent animationType="fade">
        <SafeAreaView style={styles.loadingOverlayContainer} edges={["top", "bottom"]}>
          <View style={styles.loadingOverlayBox}>
             <Animated.View style={{ opacity: pulseAnim, marginBottom: 16 }}>
               <MaterialIcons name={isPredictable ? "auto-awesome" : "cloud-sync"} size={48} color="#05e777" />
             </Animated.View>
             <Text style={styles.loadingOverlayTitle}>{title}</Text>
             <Text style={styles.loadingOverlayDesc}>{desc}</Text>
             <ActivityIndicator size="small" color="#05e777" style={{ marginTop: 24 }} />
          </View>
        </SafeAreaView>
      </Modal>
    );
  };

  return (
    <Modal visible={true} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => router.back()}>
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <StatusBar barStyle="light-content" backgroundColor="#0A0A0A" />
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color="#fff" />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">{id ? "Edit" : "Add"} {config.label}</Text>
          <View style={{ width: 40 }} />
        </View>

        <KeyboardAwareScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          enableOnAndroid
          extraScrollHeight={24}
        >
          <View style={styles.formCard}>
            {config.fields.map(renderField)}
          </View>

          <Pressable style={styles.saveBtn} onPress={handleSave} disabled={loading}>
            {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.saveBtnText}>Save</Text>}
          </Pressable>

          {id && (
            <Pressable style={styles.deleteBtn} onPress={handleDelete} disabled={loading}>
              <Text style={styles.deleteBtnText}>Delete</Text>
            </Pressable>
          )}
        </KeyboardAwareScrollView>

        <DatePickerModal
          visible={datePickerField !== null}
          initialDate={datePickerField && form[datePickerField] ? String(form[datePickerField]) : ""}
          onClose={() => setDatePickerField(null)}
          onSelect={(selectedDate: string) => {
            if (datePickerField) {
              handleChange(datePickerField, selectedDate);
            }
            setDatePickerField(null);
          }}
        />

        <ConfirmModal
          visible={deleteConfirmVisible}
          title={`Delete ${config.label}`}
          description="Are you sure you want to delete this record? This action cannot be undone."
          confirmText="Delete"
          cancelText="Cancel"
          loading={loading}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteConfirmVisible(false)}
        />

        {renderLoadingOverlay()}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A0A0A" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#fff", flex: 1, textAlign: "center" },
  backButton: { padding: 8, marginLeft: -8 },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  formCard: {
    backgroundColor: "#121212",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    padding: 18,
    marginBottom: 20,
    gap: 16,
  },
  fieldBlock: { gap: 6 },
  label: { color: "#c4c7c8", fontSize: 13, fontWeight: "600" },
  description: { color: "rgba(255,255,255,0.4)", fontSize: 11, marginBottom: 2 },
  input: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: "#fff",
    fontSize: 15,
  },
  dateInputWrap: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dateInputText: {
    color: "#fff",
    fontSize: 15,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  customSwitchContainer: {
    paddingVertical: 4,
  },
  switchTrack: {
    width: 48,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: "center",
  },
  switchThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  optionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  optionPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  optionPillActive: {
    backgroundColor: "rgba(5,231,119,0.15)",
    borderColor: "rgba(5,231,119,0.4)",
  },
  optionText: {
    color: "#8e9192",
    fontSize: 13,
    fontWeight: "500",
  },
  optionTextActive: {
    color: "#05e777",
    fontWeight: "600",
  },
  saveBtn: {
    backgroundColor: "#05e777",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  saveBtnText: { color: "#000", fontSize: 15, fontWeight: "700" },
  deleteBtn: {
    borderWidth: 1,
    borderColor: "rgba(255,75,75,0.3)",
    backgroundColor: "rgba(255,75,75,0.08)",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  deleteBtnText: { color: "#ff4b4b", fontSize: 14, fontWeight: "600" },
  errorText: { color: "#ff4b4b", textAlign: "center", marginTop: 40 },
  loadingOverlayContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loadingOverlayBox: {
    backgroundColor: "#161616",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    width: "100%",
    maxWidth: 320,
  },
  loadingOverlayTitle: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  loadingOverlayDesc: {
    color: "#8e9192",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  }
});
