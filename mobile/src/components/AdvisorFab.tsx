import React from "react";
import { MaterialIcons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function AdvisorFab() {
    const router = useRouter();
    const pathname = usePathname();
    const insets = useSafeAreaInsets();

    if (pathname.startsWith("/advisor")) {
        return null;
    }

    return (
        <View pointerEvents="box-none" style={[styles.outer, { bottom: Math.max(insets.bottom + 92, 102) }]}>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open advisor"
                onPress={() => router.push("/advisor")}
                style={({ pressed }) => [styles.button, pressed ? styles.buttonPressed : null]}
            >
                <MaterialIcons name="auto-awesome" size={25} color="#7dffa2" />
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    outer: {
        position: "absolute",
        right: 16,
        zIndex: 80,
        alignItems: "flex-end",
    },
    button: {
        minWidth: 55,
        height: 55,
        borderRadius: 31,
        borderWidth: 1,
        borderColor: "rgba(125,255,162,0.22)",
        backgroundColor: "#000000",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        shadowColor: "#000000",
        shadowOpacity: 0.58,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 10 },
        elevation: 11,
    },
    buttonPressed: {
        opacity: 0.88,
        transform: [{ scale: 0.98 }],
    },
    label: {
        color: "#e5e2e1",
        fontSize: 10,
        lineHeight: 12,
        fontFamily: "JetBrains Mono",
        fontWeight: "700",
        letterSpacing: 1,
        textTransform: "uppercase",
    },
});