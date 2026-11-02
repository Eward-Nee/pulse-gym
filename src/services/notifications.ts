import { t } from "../i18n";
import * as Notifications from "expo-notifications";
import { AppState, Platform } from "react-native";
import { useEffect, useRef, useState } from "react";
import {
  notificationController,
  type PermissionState,
} from "../core/notificationPermission";
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});
async function requestPermission() {
  if (Platform.OS === "android")
    await Notifications.setNotificationChannelAsync("challenges", {
      name: "Challenges",
      importance: Notifications.AndroidImportance.HIGH,
    });
  return Notifications.requestPermissionsAsync();
}
export function useNotificationPermission() {
  const [status, setStatus] = useState<PermissionState>(
    Platform.OS === "web" ? "unsupported" : "checking",
  );
  const controller = useRef<ReturnType<typeof notificationController> | null>(
    null,
  );
  useEffect(() => {
    const monitor = notificationController(
      {
        supported: Platform.OS !== "web",
        read: Notifications.getPermissionsAsync,
        request: requestPermission,
      },
      setStatus,
    );
    controller.current = monitor;
    void monitor.refresh();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void monitor.refresh();
    });
    return () => {
      monitor.dispose();
      subscription.remove();
      controller.current = null;
    };
  }, []);
  return {
    status,
    enable: () => controller.current?.enable(),
    refresh: () => controller.current?.refresh(),
  };
}
export async function notify(title: string, body: string) {
  if (Platform.OS === "web") return;
  const p = await Notifications.getPermissionsAsync();
  if (p.granted)
    await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger: null,
    });
}
export async function remind(id: string, date: number, title: string) {
  if (Platform.OS === "web" || date <= Date.now()) return;
  const p = await Notifications.getPermissionsAsync();
  if (!p.granted) return;
  await Notifications.cancelScheduledNotificationAsync(id);
  await Notifications.scheduleNotificationAsync({
    identifier: id,
    content: { title: t("Challenge deadline"), body: title },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(date),
      channelId: "challenges",
    },
  });
}
export async function cancelReminder(id: string) {
  if (Platform.OS !== "web")
    await Notifications.cancelScheduledNotificationAsync(id);
}
