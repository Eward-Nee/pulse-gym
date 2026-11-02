import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});
export async function enableNotifications() {
  if (Platform.OS === "web") return false;
  await Notifications.setNotificationChannelAsync("challenges", {
    name: "Challenges",
    importance: Notifications.AndroidImportance.HIGH,
  });
  const p = await Notifications.requestPermissionsAsync();
  return p.granted;
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
    content: { title: "Challenge-sperdatum", body: title },
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
