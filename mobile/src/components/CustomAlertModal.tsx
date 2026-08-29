import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Modal, Pressable, Animated } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { AlertButton, AlertType } from "../providers/AlertProvider";

const fs = (size: number) => Math.round(size * 0.9 * 10) / 10;

type CustomAlertModalProps = {
  visible: boolean;
  title: string;
  message?: string | React.ReactNode;
  type: AlertType;
  buttons: AlertButton[];
  onDismiss: () => void;
};

export function CustomAlertModal({
  visible,
  title,
  message,
  type = "info",
  buttons = [{ text: "OK" }],
  onDismiss,
}: CustomAlertModalProps) {
  const [scaleAnim] = useState(() => new Animated.Value(0.92));
  const [opacityAnim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 65,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      opacityAnim.setValue(0);
      scaleAnim.setValue(0.92);
    }
  }, [visible, opacityAnim, scaleAnim]);

  if (!visible) return null;

  const getTypeConfig = () => {
    switch (type) {
      case "success":
        return {
          icon: "check-circle" as const,
          color: "#69f0ae",
          bgColor: "rgba(105, 240, 174, 0.12)",
          borderColor: "rgba(105, 240, 174, 0.25)",
          primaryBtnBg: "#69f0ae",
          primaryBtnText: "#00381e",
        };
      case "error":
        return {
          icon: "error-outline" as const,
          color: "#ffb4ab",
          bgColor: "rgba(255, 180, 171, 0.12)",
          borderColor: "rgba(255, 180, 171, 0.25)",
          primaryBtnBg: "#ffb4ab",
          primaryBtnText: "#690005",
        };
      case "warning":
        return {
          icon: "warning-amber" as const,
          color: "#ffd54f",
          bgColor: "rgba(255, 213, 79, 0.12)",
          borderColor: "rgba(255, 213, 79, 0.25)",
          primaryBtnBg: "#ffd54f",
          primaryBtnText: "#422b00",
        };
      case "info":
      default:
        return {
          icon: "info-outline" as const,
          color: "#a3eeff",
          bgColor: "rgba(163, 238, 255, 0.12)",
          borderColor: "rgba(163, 238, 255, 0.25)",
          primaryBtnBg: "#a3eeff",
          primaryBtnText: "#00363d",
        };
    }
  };

  const typeConfig = getTypeConfig();
  const isMultiButton = buttons.length > 1;

  const handlePress = (button: AlertButton) => {
    onDismiss();
    if (button.onPress) {
      button.onPress();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onDismiss}>
      <SafeAreaView style={styles.overlay} edges={["top", "bottom"]}>
        <Animated.View
          style={[
            styles.card,
            {
              opacity: opacityAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <View style={[styles.iconContainer, { backgroundColor: typeConfig.bgColor, borderColor: typeConfig.borderColor }]}>
            <MaterialIcons name={typeConfig.icon} size={28} color={typeConfig.color} />
          </View>

          <Text style={styles.title}>{title}</Text>

          {message ? (
            typeof message === "string" ? (
              <Text style={styles.message}>{message}</Text>
            ) : (
              message
            )
          ) : null}

          <View style={[styles.actions, isMultiButton ? styles.actionsRow : styles.actionsSingle]}>
            {buttons.map((btn, idx) => {
              const isDestructive = btn.style === "destructive";
              const isCancel = btn.style === "cancel";

              let btnBg = typeConfig.primaryBtnBg;
              let btnTextColor = typeConfig.primaryBtnText;
              let btnBorder = undefined;

              if (isDestructive) {
                btnBg = "#ffb4ab";
                btnTextColor = "#690005";
              } else if (isCancel) {
                btnBg = "transparent";
                btnTextColor = "#ffffff";
                btnBorder = "rgba(255,255,255,0.12)";
              }

              return (
                <Pressable
                  key={idx}
                  style={({ pressed }) => [
                    styles.button,
                    { backgroundColor: btnBg },
                    btnBorder ? { borderWidth: 1, borderColor: btnBorder } : null,
                    isMultiButton ? { flex: 1 } : { width: "100%" },
                    pressed ? { opacity: 0.85 } : null,
                  ]}
                  onPress={() => handlePress(btn)}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      { color: btnTextColor },
                    ]}
                  >
                    {btn.text}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.76)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    backgroundColor: "#161616",
    padding: 24,
    alignItems: "center",
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  title: {
    color: "#ffffff",
    fontFamily: "Hanken Grotesk",
    fontSize: fs(22),
    lineHeight: 28,
    fontWeight: "700",
    textAlign: "center",
  },
  message: {
    color: "#c4c7c8",
    fontFamily: "Inter",
    fontSize: fs(15),
    lineHeight: 22,
    textAlign: "center",
    marginTop: 2,
    marginBottom: 6,
  },
  actions: {
    width: "100%",
    marginTop: 8,
  },
  actionsSingle: {
    flexDirection: "column",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 12,
  },
  button: {
    height: 48,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    fontFamily: "Hanken Grotesk",
    fontSize: fs(14),
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
});
