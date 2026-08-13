import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

type HomeHeaderProps = {
  ownerName: string;
  onOpenSettings: () => void;
};

export function HomeHeader({ ownerName, onOpenSettings }: HomeHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.profileRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{ownerName ? ownerName[0].toUpperCase() : "U"}</Text>
        </View>
        <View style={styles.greetingGroup}>
          <Text style={styles.subtext}>WELCOME BACK</Text>
          <Text style={styles.name}>{ownerName || "User"}</Text>
        </View>
      </View>
      <Pressable onPress={onOpenSettings} style={styles.iconBtn}>
        <MaterialIcons name="settings" size={22} color="#c4c7c8" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#d0bcff",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#381e72",
  },
  greetingGroup: {
    gap: 2,
  },
  subtext: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
    color: "#8e9192",
  },
  name: {
    fontSize: 17,
    fontWeight: "700",
    color: "#ffffff",
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#2b2930",
    alignItems: "center",
    justifyContent: "center",
  },
});
