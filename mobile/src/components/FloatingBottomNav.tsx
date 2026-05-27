import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type DockRoute = "/" | "/transactions" | "/goals" | "/settings";

type DockItem = {
    route: DockRoute;
    icon: React.ComponentProps<typeof MaterialIcons>["name"];
    label: string;
};

const DOCK_ITEMS: DockItem[] = [
    { route: "/", icon: "dashboard", label: "Dashboard" },
    { route: "/transactions", icon: "receipt-long", label: "Transactions" },
    { route: "/goals", icon: "track-changes", label: "Goals" },
    { route: "/settings", icon: "settings", label: "Settings" },
];

function activeRouteForPath(pathname: string): DockRoute | null {
    if (pathname === "/") return "/";
    if (pathname.startsWith("/transactions") || pathname.startsWith("/subscriptions") || pathname.startsWith("/insights")) return "/transactions";
    if (pathname.startsWith("/goals") || pathname.startsWith("/simulation")) return "/goals";
    if (pathname.startsWith("/settings")) return "/settings";
    return null;
}

export default function FloatingBottomNav() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const pathname = usePathname();
    const isAdvisorRoute = pathname.startsWith("/advisor");

    const activeRoute = activeRouteForPath(pathname);
    const [dockWidth, setDockWidth] = useState(0);
    const [translateX] = useState(() => new Animated.Value(0));
    const hasAnimated = useRef(false);

    const activeIndex = useMemo(() => {
        const index = DOCK_ITEMS.findIndex((item) => item.route === activeRoute);
        return index < 0 ? 0 : index;
    }, [activeRoute]);

    const segmentWidth = useMemo(() => {
        if (dockWidth <= 8) return 0;
        return (dockWidth - 8) / DOCK_ITEMS.length;
    }, [dockWidth]);

    useEffect(() => {
        if (!segmentWidth) return;

        const targetX = activeIndex * segmentWidth;
        if (!hasAnimated.current) {
            translateX.setValue(targetX);
            hasAnimated.current = true;
            return;
        }

        Animated.timing(translateX, {
            toValue: targetX,
            duration: 260,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        }).start();
    }, [activeIndex, segmentWidth, translateX]);

    if (isAdvisorRoute) {
        return null;
    }

    return (
        <View pointerEvents="box-none" style={[styles.outer, { bottom: Math.max(insets.bottom + 8, 14) }]}>
            <View style={styles.dock} onLayout={(event) => setDockWidth(event.nativeEvent.layout.width)}>
                {segmentWidth ? (
                    <Animated.View
                        pointerEvents="none"
                        style={[
                            styles.activeCapsule,
                            {
                                width: segmentWidth,
                                transform: [{ translateX }],
                            },
                        ]}
                    />
                ) : null}

                {DOCK_ITEMS.map((item) => {
                    const active = item.route === activeRoute;

                    return (
                        <View key={item.route} style={styles.segment}>
                            <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={item.label}
                                onPress={() => {
                                    if (item.route !== activeRoute) {
                                        router.push(item.route);
                                    }
                                }}
                                style={({ pressed }) => [styles.button, active ? styles.buttonActive : null, pressed ? styles.buttonPressed : null]}
                            >
                                <MaterialIcons
                                    name={item.icon}
                                    size={24}
                                    color={active ? "#4ADE80" : "#9ca3af"}
                                    style={active ? styles.activeIconGlow : undefined}
                                />
                            </Pressable>
                        </View>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    outer: {
        position: "absolute",
        left: 0,
        right: 0,
        zIndex: 70,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 16,
    },
    dock: {
        width: "100%",
        maxWidth: 420,
        borderRadius: 36,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.10)",
        backgroundColor: "#000000",
        padding: 4,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        shadowColor: "#000000",
        shadowOpacity: 0.6,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 8 },
        elevation: 10,
    },
    segment: {
        flex: 1,
        position: "relative",
        alignItems: "center",
        justifyContent: "center",
    },
    activeCapsule: {
        position: "absolute",
        top: 4,
        bottom: 4,
        left: 4,
        borderRadius: 32,
        backgroundColor: "rgba(48,48,48,0.70)",
        borderBottomWidth: 1,
        borderBottomColor: "rgba(0,0,0,0.55)",
    },
    button: {
        width: "100%",
        minHeight: 56,
        borderRadius: 28,
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1,
    },
    buttonActive: {
        transform: [{ translateY: -1 }],
    },
    buttonPressed: {
        opacity: 0.86,
    },
    activeIconGlow: {
        textShadowColor: "rgba(74,222,128,0.32)",
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 8,
    },
});
