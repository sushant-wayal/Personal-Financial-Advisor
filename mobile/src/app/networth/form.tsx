import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator, Alert, Animated, Modal, StatusBar } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { MaterialIcons } from "@expo/vector-icons";
import { NETWORTH_CONFIG, FieldConfig } from "../../lib/networthConfig";
import { fetchNetWorth, createNetWorth, updateNetWorth, deleteNetWorth, NetWorthData } from "../../lib/networthApi";
import { DatePickerModal, fullDateLabel } from "../../components/DatePickerModal";
import { formatIndianAmountInput, parseIndianAmountInput } from "../../providers/CurrencyProvider";
import { ConfirmModal } from "../../components/ConfirmModal";

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
  }, [loading]);

  useEffect(() => {
    if (id) {
      fetchNetWorth().then(setData => setNetworthData(setData)).catch(console.error);
    }
  }, [id]);

  useEffect(() => {
    if (id && networthData) {
      // Find the existing item
      const category = config.category === "asset" ? "assets" : "liabilities";
      const items = (networthData as any)[category][type] || [];
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
  }, [id, networthData, config]);

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
            Alert.alert("Missing Field", `${field.label} is required.`);
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
      Alert.alert("Error", e.message || "Failed to save");
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
      Alert.alert("Error", e.message || "Failed to delete");
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
              <MaterialIcons name="delete-outline" size={18} color="#FF453A" />
              <Text style={styles.deleteBtnText}>Delete</Text>
            </Pressable>
          )}
        </KeyboardAwareScrollView>

        <DatePickerModal 
          visible={!!datePickerField}
          initialDate={datePickerField ? form[datePickerField] : null}
          disableFuture={datePickerField ? ["startDate", "purchaseDate", "setupDate", "borrowDate", "annualInterestCreditDate"].includes(datePickerField) : false}
          disablePast={datePickerField ? ["maturityDate", "expectedReturnDate", "nextRepaymentDate"].includes(datePickerField) : false}
          onClose={() => setDatePickerField(null)}
          onSelect={(date) => {
            if (datePickerField) handleChange(datePickerField, date);
          }}
        />
        {renderLoadingOverlay()}
        
        <ConfirmModal
          visible={deleteConfirmVisible}
          title="Delete Asset"
          description="Are you sure you want to delete this? This action cannot be undone."
          onCancel={() => setDeleteConfirmVisible(false)}
          onConfirm={() => void confirmDelete()}
          loading={loading}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#131313" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  errorText: { color: "#ffb4ab", fontSize: 16 },
  header: { height: 96, paddingTop: 14, paddingHorizontal: 24, borderBottomWidth: 1, borderBottomColor: "rgba(68,71,72,0.20)", backgroundColor: "rgba(19,19,19,0.94)", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backButton: { width: 40, height: 40, marginLeft: -8, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, textAlign: "center", color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: 20, fontWeight: "700", paddingHorizontal: 12 },
  scroll: { flex: 1 },
  scrollContent: { padding: 24 },
  formCard: { borderRadius: 16, borderWidth: 1, borderColor: "rgba(68,71,72,0.35)", backgroundColor: "#0e0e0e", padding: 22, gap: 20, marginBottom: 32 },
  fieldBlock: {},
  label: { color: "#8e9192", fontFamily: "JetBrains Mono", fontSize: 12, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 10 },
  description: { color: "rgba(196,199,200,0.6)", fontSize: 13, lineHeight: 18, marginBottom: 12 },
  input: { minHeight: 54, borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", backgroundColor: "#1A1A1A", color: "#ffffff", paddingHorizontal: 16, fontSize: 16 },
  dateInputWrap: { minHeight: 54, borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", backgroundColor: "#1A1A1A", paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dateInputText: { color: "#ffffff", fontSize: 16 },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  customSwitchContainer: { padding: 4 },
  switchTrack: { width: 44, height: 24, borderRadius: 12, borderWidth: 1, justifyContent: "center" },
  switchThumb: { width: 18, height: 18, borderRadius: 9, position: "absolute" },
  optionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  optionPill: { height: 38, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, borderRadius: 999, backgroundColor: "#1A1A1A", borderWidth: 1, borderColor: "#333333" },
  optionPillActive: { backgroundColor: "rgba(5,231,119,0.14)", borderColor: "#05e777" },
  optionText: { color: "#e5e2e1", fontSize: 14, letterSpacing: 0.7, fontWeight: "500", fontFamily: "JetBrains Mono" },
  optionTextActive: { color: "#7dffa2" },
  saveBtn: { height: 50, borderRadius: 8, backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center" },
  saveBtnText: { color: "#000000", fontFamily: "JetBrains Mono", fontSize: 14, letterSpacing: 1.6, textTransform: "uppercase", fontWeight: "700" },
  deleteBtn: { marginTop: 16, height: 50, borderRadius: 8, backgroundColor: "transparent", borderWidth: 1, borderColor: "rgba(255, 69, 58, 0.4)", alignItems: "center", justifyContent: "center", flexDirection: "row" },
  deleteBtnText: { color: "#FF453A", fontFamily: "JetBrains Mono", fontSize: 14, letterSpacing: 1.2, textTransform: "uppercase", fontWeight: "700", marginLeft: 8 },
  loadingOverlayContainer: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "center", alignItems: "center" },
  loadingOverlayBox: { width: "80%", backgroundColor: "#1A1A1A", borderRadius: 20, padding: 32, alignItems: "center", borderWidth: 1, borderColor: "rgba(5,231,119,0.3)" },
  loadingOverlayTitle: { color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: 22, fontWeight: "700", marginBottom: 12, textAlign: "center" },
  loadingOverlayDesc: { color: "rgba(255,255,255,0.7)", fontSize: 14, lineHeight: 22, textAlign: "center", fontFamily: "JetBrains Mono" },
});
