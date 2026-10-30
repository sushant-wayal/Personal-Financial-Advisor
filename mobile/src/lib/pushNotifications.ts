import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { API_BASE_URL } from "./apiBaseUrl";

// Configure how notifications should be handled when app is open in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Requests push notification permission and registers the device's Expo push token
 * with the North backend (stored in AIMemory as 'expo_push_token').
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  // Push notifications only apply to native mobile devices (iOS / Android)
  if (Platform.OS === "web") {
    return null;
  }

  if (!Device.isDevice) {
    console.info("[pushNotifications] Push notifications require a physical device.");
    return null;
  }

  try {
    // 1. Check existing permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // 2. Request permission if not already granted
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.warn("[pushNotifications] Push notification permission denied by user.");
      return null;
    }

    // 3. Configure Android notification channel
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "North Proactive Intel",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#22d3ee",
      });
    }

    // 4. Resolve EAS Project ID
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId ??
      "307c8512-73eb-4e2e-bb6b-6f9bf6b73ebf";

    // 5. Fetch device's Expo Push Token
    const tokenResponse = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    const token = tokenResponse.data;

    // 6. Register token with backend so morning crons can push directly to this device
    if (token) {
      await fetch(`${API_BASE_URL}/api/notifications/register-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expoPushToken: token }),
      });
      console.info(`[pushNotifications] Registered device push token with backend: ${token.slice(0, 15)}...`);
    }

    return token;
  } catch (err) {
    console.warn("[pushNotifications] Failed to obtain/register Expo push token:", err);
    return null;
  }
}
