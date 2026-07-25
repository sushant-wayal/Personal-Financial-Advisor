import React from "react";
import { View, StyleSheet, Pressable, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { BudgetsView } from "../components/budgets/BudgetsView";

const fs = (size: number) => Math.round(size * 0.9 * 10) / 10;

export default function BudgetsScreen() {
    const router = useRouter();

    return (
        <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
            <StatusBar style="light" backgroundColor="#131313" />
            <View style={styles.container}>
                <View style={styles.topBar}>
                    <View style={styles.topBarLeft}>
                        <Pressable style={({ pressed }) => [styles.iconButton, pressed ? styles.iconPressed : null]} onPress={() => router.back()}>
                            <MaterialIcons name="arrow-back" size={24} color="#ffffff" />
                        </Pressable>
                        <Text style={styles.headerTitle}>Category Budgets</Text>
                    </View>
                </View>
                <BudgetsView />
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: "#131313" },
    container: { flex: 1, backgroundColor: "#131313" },
    topBar: {
        height: 64,
        borderBottomWidth: 1,
        borderBottomColor: "#444748",
        paddingHorizontal: 24,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: "#131313",
    },
    topBarLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
    headerTitle: { color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: fs(18), lineHeight: 24, fontWeight: "600", marginLeft: 4 },
    iconButton: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
    iconPressed: { backgroundColor: "rgba(255,255,255,0.05)", transform: [{ scale: 0.95 }] },
});
