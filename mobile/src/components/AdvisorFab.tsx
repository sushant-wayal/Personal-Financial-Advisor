import React, { useEffect, useRef } from "react";
import { MaterialIcons } from "@expo/vector-icons";
import { Pressable, StyleSheet, View, Animated, Easing } from "react-native";
import { usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAdvisorContext } from "../providers/AdvisorProvider";

export default function AdvisorFab() {
    const { isAdvisorOpen, openAdvisor } = useAdvisorContext();
    const pathname = usePathname();
    const insets = useSafeAreaInsets();

    const anim1 = useRef(new Animated.Value(0)).current;
    const anim2 = useRef(new Animated.Value(0)).current;
    const anim3 = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Disabling useNativeDriver to guarantee no native-thread loop sync bugs
        Animated.loop(Animated.timing(anim1, { toValue: 1, duration: 3500, easing: Easing.linear, useNativeDriver: false })).start();
        Animated.loop(Animated.timing(anim2, { toValue: 1, duration: 5500, easing: Easing.linear, useNativeDriver: false })).start();
        Animated.loop(Animated.timing(anim3, { toValue: 1, duration: 4500, easing: Easing.linear, useNativeDriver: false })).start();
    }, [anim1, anim2, anim3]);

    const spin1 = anim1.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
    const spin2 = anim2.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
    const spin3 = anim3.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

    return (
        <View pointerEvents="box-none" style={[styles.outer, { bottom: Math.max(insets.bottom + 92, 102) }]}>
            <View style={styles.container}>
                {/* Orbits */}
                {/* Orbit 1: Wide radius, slightly off-center */}
                <View style={[StyleSheet.absoluteFill, styles.orbitCenter]} pointerEvents="none">
                    <Animated.View style={[StyleSheet.absoluteFill, styles.orbitCenter, { transform: [{ rotate: spin1 }] }]}>
                        <View style={[styles.dot, styles.dot1, { transform: [{ translateY: -46 }, { translateX: -6 }] }]} />
                    </Animated.View>
                </View>

                {/* Orbit 2: Wider radius, shifted center, starting at different phase */}
                <View style={[StyleSheet.absoluteFill, styles.orbitCenter]} pointerEvents="none">
                    <Animated.View style={[StyleSheet.absoluteFill, styles.orbitCenter, { transform: [{ rotate: spin2 }, { rotate: "120deg" }] }]}>
                        <View style={[styles.dot, styles.dot2, { transform: [{ translateY: -52 }, { translateX: 12 }] }]} />
                    </Animated.View>
                </View>

                {/* Orbit 3: Eccentric orbit */}
                <View style={[StyleSheet.absoluteFill, styles.orbitCenter]} pointerEvents="none">
                    <Animated.View style={[StyleSheet.absoluteFill, styles.orbitCenter, { transform: [{ rotate: spin3 }, { rotate: "240deg" }] }]}>
                        <View style={[styles.dot, styles.dot3, { transform: [{ translateY: -38 }, { translateX: -14 }] }]} />
                    </Animated.View>
                </View>

                {/* Core Button */}
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Open advisor"
                    onPress={() => openAdvisor()}
                    style={({ pressed }) => [styles.button, pressed ? styles.buttonPressed : null]}
                >
                    <MaterialIcons name="auto-awesome" size={24} color="#a78bfa" />
                </Pressable>
            </View>
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
    container: {
        width: 72,
        height: 72,
        alignItems: "center",
        justifyContent: "center",
    },
    orbitCenter: {
        alignItems: "center",
        justifyContent: "center",
    },
    dot: {
        position: "absolute",
        borderRadius: 50,
    },
    dot1: {
        width: 6,
        height: 6,
        backgroundColor: "rgba(167, 139, 250, 0.95)",
        shadowColor: "#a78bfa",
        shadowOpacity: 0.8,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 0 },
        elevation: 4,
    },
    dot2: {
        width: 4,
        height: 4,
        backgroundColor: "rgba(167, 139, 250, 0.65)",
        shadowColor: "#a78bfa",
        shadowOpacity: 0.6,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 0 },
        elevation: 3,
    },
    dot3: {
        width: 3.5,
        height: 3.5,
        backgroundColor: "rgba(167, 139, 250, 0.45)",
        shadowColor: "#a78bfa",
        shadowOpacity: 0.4,
        shadowRadius: 3,
        shadowOffset: { width: 0, height: 0 },
        elevation: 2,
    },
    button: {
        width: 55,
        height: 55,
        borderRadius: 31,
        borderWidth: 1,
        borderColor: "rgba(167, 139, 250, 0.22)",
        backgroundColor: "#0a0a0c",
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "rgba(167, 139, 250, 0.5)",
        shadowOpacity: 0.25,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 4 },
        elevation: 11,
    },
    buttonPressed: {
        opacity: 0.88,
        transform: [{ scale: 0.95 }],
        borderColor: "rgba(167, 139, 250, 0.4)",
    },
});
