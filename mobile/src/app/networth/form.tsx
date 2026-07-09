import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Switch, ActivityIndicator, Alert } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { NETWORTH_CONFIG, FieldConfig } from "../../lib/networthConfig";
import { useCreateNetWorth, useUpdateNetWorth, useDeleteNetWorth, useNetWorth } from "../../lib/networthApi";

export default function NetWorthFormScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const type = params.type as string;
  const id = params.id as string | undefined;

  const config = NETWORTH_CONFIG[type];
  const { data: networthData } = useNetWorth();

  const [form, setForm] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);

  const createMutation = useCreateNetWorth();
  const updateMutation = useUpdateNetWorth();
  const deleteMutation = useDeleteNetWorth();

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
        await updateMutation.mutateAsync({ type, id, data: payload });
      } else {
        await createMutation.mutateAsync({ type, data: payload });
      }
      
      router.back();
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to save");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert("Delete", "Are you sure you want to delete this?", [
      { text: "Cancel", style: "cancel" },
      { 
        text: "Delete", 
        style: "destructive",
        onPress: async () => {
          setLoading(true);
          try {
            await deleteMutation.mutateAsync({ type, id: id! });
            router.back();
          } catch (e: any) {
            Alert.alert("Error", e.message || "Failed to delete");
          } finally {
            setLoading(false);
          }
        }
      }
    ]);
  };

  const renderField = (field: FieldConfig) => {
    const value = form[field.name];

    if (field.type === "boolean") {
      return (
        <View key={field.name} style={styles.switchRow}>
          <Text style={styles.label}>{field.label} {field.required && "*"}</Text>
          <Switch 
            value={!!value}
            onValueChange={(v) => handleChange(field.name, v)}
            trackColor={{ false: "rgba(255,255,255,0.1)", true: "#7dffa2" }}
          />
        </View>
      );
    }

    if (field.type === "select") {
      return (
        <View key={field.name} style={styles.fieldBlock}>
          <Text style={styles.label}>{field.label} {field.required && "*"}</Text>
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

    return (
      <View key={field.name} style={styles.fieldBlock}>
        <Text style={styles.label}>{field.label} {field.required && "*"}</Text>
        <TextInput
          style={styles.input}
          value={value !== undefined ? String(value) : ""}
          onChangeText={(text) => handleChange(field.name, text)}
          placeholder={field.type === "date" ? "YYYY-MM-DD" : `Enter ${field.label.toLowerCase()}`}
          placeholderTextColor="rgba(255,255,255,0.3)"
          keyboardType={field.type === "number" ? "numeric" : "default"}
        />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>{id ? "Edit" : "Add"} {config.label}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
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
        
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  errorText: { color: "#ffb4ab", fontSize: 16 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 18, color: "#fff", fontWeight: "600" },
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },
  formCard: { backgroundColor: "rgba(255,255,255,0.03)", borderRadius: 16, padding: 16, marginBottom: 24 },
  fieldBlock: { marginBottom: 20 },
  label: { color: "rgba(255,255,255,0.7)", fontSize: 13, marginBottom: 8, fontWeight: "500" },
  input: { backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 8, paddingHorizontal: 16, paddingVertical: 14, color: "#fff", fontSize: 16 },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
  optionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  optionPill: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  optionPillActive: { backgroundColor: "rgba(125,255,162,0.1)", borderColor: "#7dffa2" },
  optionText: { color: "rgba(255,255,255,0.6)", fontSize: 14, fontWeight: "500" },
  optionTextActive: { color: "#7dffa2" },
  saveBtn: { backgroundColor: "#7dffa2", borderRadius: 12, paddingVertical: 16, alignItems: "center" },
  saveBtnText: { color: "#000", fontSize: 16, fontWeight: "700" },
  deleteBtn: { marginTop: 16, backgroundColor: "rgba(255,180,171,0.1)", borderRadius: 12, paddingVertical: 16, alignItems: "center" },
  deleteBtnText: { color: "#ffb4ab", fontSize: 16, fontWeight: "600" },
});
