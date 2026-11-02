import React, { useState } from "react";
import appConfig from "../../app.json";
import {
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  Switch,
  Text,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import {
  Button,
  Card,
  Chip,
  Empty,
  Field,
  Heading,
  Label,
  Pill,
  Row,
  Sheet,
  T,
  Wallpaper,
  useTheme,
} from "../components/ui";
import { LANGUAGES, t, tn, locale } from "../i18n";
import { type Snapshot, type Settings, type Workout } from "../core/model";
import { parseInvite, fingerprint, type Invite } from "../core/protocol";
import { getIdentity } from "../services/identity";
import { setPartner, updateSettings, permissions, uid } from "../services/db";
import {
  acceptFriend,
  addFriend,
  canConnect,
  ownInvite,
  shareSnapshot,
} from "../services/peers";
import { useNotificationPermission } from "../services/notifications";
import {
  checkRelease,
  installRelease,
  type Release,
} from "../services/updates";
export type Act = (task: () => Promise<unknown>, message?: string) => void;
export default function Setup({
  data,
  act,
  onRemove,
  onImport,
  onHyrox,
  networkStatus,
}: {
  data: Snapshot;
  act: Act;
  onRemove: (id: string) => void;
  onImport: (w: Workout) => void;
  onHyrox: () => void;
  networkStatus: string;
}) {
  const { c } = useTheme();
  const notifications = useNotificationPermission();
  const [name, setName] = useState(data.settings.name),
    [code, setCode] = useState(""),
    [invite, setInvite] = useState<Invite | null>(null),
    [myCode, setMyCode] = useState(""),
    [id, setId] = useState(""),
    [friendId, showFriend] = useState<string | null>(null),
    [release, setRelease] = useState<Release | null>(null),
    [working, setWorking] = useState(false),
    [note, setNote] = useState("");
  const friend = data.friends.find((f) => f.id === friendId),
    partner = data.friends.find((f) => f.id === data.partnerId),
    eligible = data.friends.filter(
      (f) => f.status === "accepted" && f.verified,
    );
  const patch = (partial: Partial<Settings>) =>
    act(() => updateSettings(partial));
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ padding: 22, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
    >
      <Label>{t("YOUR SPACE / YOUR RULES")}</Label>
      <Heading
        title={t("Make it yours.")}
        subtitle={t("Pick your look. Bring your people.")}
      />
      <Card>
        <Row>
          <Image
            source={require("../../assets/icon.png")}
            style={{ width: 54, height: 54, borderRadius: 16 }}
          />
          <View>
            <T size={20} bold>
              Pulse Gym
            </T>
            <T muted size={12}>
              {t("Private. Local. Personal.")}
            </T>
          </View>
        </Row>
        <View style={{ marginTop: 18 }}>
          <Field
            label={t("Your name")}
            value={name}
            maxLength={60}
            onChangeText={setName}
          />
          <Button
            small
            label={t("Save name")}
            onPress={() => {
              if (name.trim()) patch({ name: name.trim() });
            }}
          />
        </View>
      </Card>
      <Label>{t("LANGUAGE")}</Label>
      <Row style={{ marginBottom: 18 }}>
        {LANGUAGES.map((l) => (
          <Chip
            key={l.code}
            label={l.label}
            selected={data.settings.language === l.code}
            onPress={() => patch({ language: l.code })}
          />
        ))}
      </Row>
      <Label>{t("THEME")}</Label>
      <Row style={{ marginBottom: 18 }}>
        <Chip
          label="Pulse Social"
          selected={data.settings.theme === "pulse"}
          onPress={() => patch({ theme: "pulse" })}
        />
        <Chip
          label="♥ Couples"
          selected={data.settings.theme === "couples"}
          onPress={() => patch({ theme: "couples" })}
        />
      </Row>
      <Card>
        <Row style={{ justifyContent: "space-between" }}>
          <T size={18} bold>
            {t("Your partner")}
          </T>
          <Pill>{t("Max. 1")}</Pill>
        </Row>
        <T muted size={12} style={{ marginVertical: 10 }}>
          {t(
            "Pick one accepted, verified friend. The Couples theme also works before you pick a partner.",
          )}
        </T>
        <Row>
          <Chip
            label={t("No partner")}
            selected={!data.partnerId}
            onPress={() =>
              act(() => setPartner(null), t("Partner disconnected."))
            }
          />
          {eligible.map((f) => (
            <Chip
              key={f.id}
              label={f.name}
              selected={f.id === data.partnerId}
              onPress={() =>
                act(
                  () => setPartner(f.id),
                  t("{name} is now your only partner.", { name: f.name }),
                )
              }
            />
          ))}
        </Row>
        {partner && (
          <T style={{ color: c.accent }} bold>
            {data.settings.name} ♥ {partner.name}
          </T>
        )}
        {!eligible.length && (
          <T muted size={12}>
            {t("Add a friend below and verify the key.")}
          </T>
        )}
      </Card>
      <Label>{t("WALLPAPER")}</Label>
      <View style={{ flexDirection: "row", gap: 10, marginBottom: 18 }}>
        {(
          [
            ["iron", t("Iron / warm")],
            ["steel", t("Steel / cool")],
            ["plain", t("Calm / solid")],
          ] as const
        ).map(([wallpaper, label]) => {
          const selected = data.settings.wallpaper === wallpaper;
          return (
            <Pressable
              key={wallpaper}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{ selected }}
              onPress={() => patch({ wallpaper })}
              style={{ flex: 1 }}
            >
              <Wallpaper
                wallpaper={wallpaper}
                couples={data.settings.theme === "couples"}
                style={{
                  height: 86,
                  borderRadius: 16,
                  borderWidth: 2,
                  borderColor: selected ? c.accent : c.line,
                  justifyContent: "flex-end",
                  padding: 8,
                }}
              >
                <Text
                  numberOfLines={2}
                  style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}
                >
                  {selected ? "✓ " : ""}
                  {label}
                </Text>
              </Wallpaper>
            </Pressable>
          );
        })}
      </View>
      <Card>
        <Row style={{ justifyContent: "space-between" }}>
          <T>{t("Reduce motion")}</T>
          <Switch
            value={data.settings.reducedMotion}
            onValueChange={(reducedMotion) => patch({ reducedMotion })}
            trackColor={{ true: c.accent }}
          />
        </Row>
      </Card>
      <Card>
        <Label>HYROX MIXED DOUBLES</Label>
        <T bold>{data.settings.raceDate || t("Your race date is waiting.")}</T>
        <T muted size={12} style={{ marginVertical: 10 }}>
          {t(
            "Beginner or regular training base, 3–5 days and editable weekly programs.",
          )}
        </T>
        <Button
          label={t("Set date & program")}
          icon="calendar-outline"
          onPress={onHyrox}
        />
      </Card>
      <Heading
        title={t("Your people.")}
        subtitle={t("Connect directly. No central friend database.")}
      />
      <Card>
        <Label>{t("DIRECT CONNECTION")}</Label>
        <T size={12} muted>
          {networkStatus}
        </T>
        <T muted size={12} style={{ marginTop: 8 }}>
          {t(
            "Use the same Wi-Fi, with both apps open. The long invitation code contains your shareable ID, public key and network address. A short ID alone cannot locate a phone on the internet.",
          )}
        </T>
        {!canConnect() && (
          <T muted size={12} style={{ marginTop: 8 }}>
            {Platform.OS === "web"
              ? t(
                  "This browser version is for your own workouts and design review. Connecting requires the native build.",
                )
              : t(
                  "Direct sockets require a development or release build; Expo Go does not include them.",
                )}
          </T>
        )}
        <View style={{ marginTop: 14 }}>
          <Button
            label={id ? t("Hide ID") : t("Show my ID")}
            onPress={() =>
              id
                ? setId("")
                : act(async () => {
                    setId((await getIdentity()).id);
                  })
            }
          />
        </View>
        {!!id && (
          <T size={12} style={{ marginTop: 10 }} selectable>
            {id}
          </T>
        )}
        <View style={{ marginTop: 10 }}>
          <Button
            label={t("Create invitation code")}
            icon="share-social-outline"
            disabled={!canConnect()}
            onPress={() => act(async () => setMyCode(await ownInvite()))}
          />
        </View>
        {!!myCode && (
          <>
            <Field
              label={t("Your invitation")}
              value={myCode}
              multiline
              editable={false}
            />
            <Row>
              <Button
                small
                label={t("Copy")}
                onPress={() =>
                  act(
                    () => Clipboard.setStringAsync(myCode),
                    t("Invitation copied."),
                  )
                }
              />
              <Button
                small
                label={t("Share")}
                onPress={() => act(() => Share.share({ message: myCode }))}
              />
            </Row>
          </>
        )}
      </Card>
      <Card>
        <Field
          label={t("Add a friend via invitation code")}
          placeholder="PULSE1:…"
          value={code}
          multiline
          autoCapitalize="none"
          onChangeText={setCode}
        />
        <Button
          label={t("Read invitation")}
          disabled={!canConnect()}
          onPress={() =>
            act(async () => {
              setInvite(parseInvite(code.trim()));
            })
          }
        />
      </Card>
      {data.friends.length === 0 && (
        <Empty
          icon="people-outline"
          title={t("Open your circle.")}
          body={t(
            "Share your code with a friend. Then confirm each other’s key fingerprint.",
          )}
        />
      )}
      {data.friends.map((f) => (
        <Card key={f.id}>
          <Row style={{ justifyContent: "space-between" }}>
            <View>
              <T bold size={18}>
                {f.name}
                {f.id === data.partnerId ? " ♥" : ""}
              </T>
              <T muted size={11}>
                {f.status === "accepted"
                  ? t("Friend")
                  : t("Waiting for acceptance")}{" "}
                · {f.verified ? t("key verified") : t("key unverified")}
              </T>
            </View>
            <Button label={t("View")} small onPress={() => showFriend(f.id)} />
          </Row>
        </Card>
      ))}
      <Card>
        <Label>{t("NOTIFICATIONS")}</Label>
        <T muted size={12} style={{ marginBottom: 12 }}>
          {t(
            "Get a local notification when a direct challenge arrives, and a reminder at the deadline. A closed app is not woken up without a push service.",
          )}
        </T>
        {notifications.status === "enabled" ? (
          <Pill>{t("Notifications enabled")}</Pill>
        ) : notifications.status === "unsupported" ? (
          <T muted>{t("Notifications are available in the Android app.")}</T>
        ) : (
          <>
            {notifications.status === "error" && (
              <T muted>{t("Could not check permission. Try again.")}</T>
            )}
            {notifications.status === "blocked" && (
              <T muted>
                {t("Allow notifications in your phone’s app settings.")}
              </T>
            )}
            <Button
              label={
                notifications.status === "checking"
                  ? t("Checking permission…")
                  : notifications.status === "blocked"
                    ? t("Open notification settings")
                    : notifications.status === "error"
                      ? t("Try again")
                      : t("Enable notifications")
              }
              icon="notifications-outline"
              disabled={notifications.status === "checking"}
              onPress={() =>
                act(async () => {
                  if (notifications.status === "blocked")
                    await Linking.openSettings();
                  else if (notifications.status === "error")
                    await notifications.refresh();
                  else await notifications.enable();
                })
              }
            />
          </>
        )}
      </Card>
      <Card>
        <Label>{t("APP UPDATES")}</Label>
        <T muted size={12} style={{ marginBottom: 12 }}>
          {t("Look for the latest Pulse Gym version. No setup needed.")}
        </T>
        <Button
          label={working ? t("Checking…") : t("Check for update")}
          disabled={working}
          icon="download-outline"
          onPress={() => {
            setWorking(true);
            act(async () => {
              try {
                const result = await checkRelease();
                setRelease(result);
              } finally {
                setWorking(false);
              }
            });
          }}
        />
        {release && (
          <View style={{ marginTop: 16 }}>
            <T bold>
              {release.version} ·{" "}
              {release.newer
                ? t("New version available")
                : t("No newer stable version")}
            </T>
            <T muted size={12} style={{ marginVertical: 10 }}>
              {release.notes}
            </T>
            {release.newer && (
              <Button
                label={
                  working
                    ? t("Downloading & verifying…")
                    : release.apk && Platform.OS === "android"
                      ? t("Download APK & open installer")
                      : t("Open GitHub release")
                }
                disabled={working}
                onPress={() => {
                  setWorking(true);
                  act(async () => {
                    try {
                      await installRelease(release);
                    } finally {
                      setWorking(false);
                    }
                  });
                }}
              />
            )}
          </View>
        )}
        <T muted size={11} style={{ marginTop: 12 }}>
          {t(
            "Install a built release, not source code. Android confirms the installation; iPhone distribution needs Apple’s supported route.",
          )}
        </T>
      </Card>
      {!!note && <T style={{ color: c.accent }}>{note}</T>}
      <T size={11} muted style={{ textAlign: "center" }}>
        Pulse Gym {appConfig.expo.version} · {t("SQLite on your device")}
      </T>
      {invite && (
        <Sheet title={t("Verify your friend")} onClose={() => setInvite(null)}>
          <Heading title={invite.name} subtitle={invite.id} />
          <Label>{t("PUBLIC KEY FINGERPRINT")}</Label>
          <T selectable size={12}>
            {fingerprint(invite.publicKey)}
          </T>
          <T muted style={{ marginVertical: 20 }}>
            {t(
              "Compare the full code with your friend through a channel you trust. Only add the friend if it matches.",
            )}
          </T>
          <Button
            primary
            label={t("Key matches · send request")}
            onPress={() =>
              act(async () => {
                await addFriend(code.trim());
                setInvite(null);
                setCode("");
              }, t("Request in outbox. Your friend must accept it."))
            }
          />
        </Sheet>
      )}
      {friend && (
        <Sheet title={friend.name} onClose={() => showFriend(null)}>
          <Pill>
            {friend.id === data.partnerId
              ? t("Your partner")
              : friend.status === "accepted"
                ? t("Your friend")
                : t("Friend request")}
          </Pill>
          <Label>{t("PUBLIC KEY FINGERPRINT")}</Label>
          <T selectable size={12}>
            {fingerprint(friend.publicKey)}
          </T>
          {friend.status === "pending" && (
            <>
              <T muted style={{ marginVertical: 16 }}>
                {t(
                  "Compare the full fingerprint with your friend before accepting.",
                )}
              </T>
              <Button
                primary
                label={t("Verified · accept friend")}
                onPress={() =>
                  act(
                    () => acceptFriend(friend.id),
                    t("Friend accepted. Confirmation in outbox."),
                  )
                }
              />
            </>
          )}
          <Card style={{ marginTop: 20 }}>
            <Label>{t("YOUR SHARING PERMISSIONS")}</Label>
            <Row style={{ justifyContent: "space-between", marginBottom: 12 }}>
              <T>{t("My templates")}</T>
              <Switch
                disabled={friend.status !== "accepted"}
                value={!!friend.shareTemplates}
                onValueChange={(v) =>
                  act(async () => {
                    await permissions(friend.id, v, !!friend.shareHistory);
                    await shareSnapshot(friend.id);
                  }, t("Sharing preference saved; sync in outbox."))
                }
              />
            </Row>
            <Row style={{ justifyContent: "space-between" }}>
              <T>{t("My history")}</T>
              <Switch
                disabled={friend.status !== "accepted"}
                value={!!friend.shareHistory}
                onValueChange={(v) =>
                  act(async () => {
                    await permissions(friend.id, !!friend.shareTemplates, v);
                    await shareSnapshot(friend.id);
                  }, t("Sharing preference saved; sync in outbox."))
                }
              />
            </Row>
            <T muted size={11} style={{ marginVertical: 12 }}>
              {t(
                "Switching off sends an empty shared view at the next connection. Copies already imported cannot be withdrawn.",
              )}
            </T>
            <Button
              label={t("Share latest version")}
              disabled={friend.status !== "accepted"}
              onPress={() =>
                act(
                  () => shareSnapshot(friend.id),
                  t("Latest shared data in outbox."),
                )
              }
            />
          </Card>
          <Label>{t("FRIEND’S SHARED TEMPLATES")}</Label>
          {friend.templates.length ? (
            friend.templates.map((w) => (
              <Card key={w.id}>
                <T bold>{w.name}</T>
                <T muted size={12}>
                  {tn(w.exercises.length, "{n} exercise", "{n} exercises")}
                </T>
                <Button
                  small
                  label={t("Use template")}
                  onPress={() =>
                    onImport({
                      ...w,
                      id: uid(),
                      exercises: w.exercises.map((e) => ({ ...e, id: uid() })),
                    })
                  }
                />
              </Card>
            ))
          ) : (
            <T muted>{t("Your friend has not shared any templates yet.")}</T>
          )}
          <Label>{t("FRIEND’S SHARED HISTORY")}</Label>
          {friend.history.length ? (
            friend.history.map((h, i) => (
              <View key={i} style={{ marginBottom: 12 }}>
                <T bold>{h.name}</T>
                <T muted size={12}>
                  {new Date(h.finishedAt).toLocaleDateString(locale())} ·{" "}
                  {Math.round(h.seconds / 60)} min
                </T>
              </View>
            ))
          ) : (
            <T muted>{t("No shared history yet.")}</T>
          )}
          {!!friend.syncedAt && (
            <T muted size={11}>
              {t("Last received: {date}", {
                date: new Date(friend.syncedAt).toLocaleString(locale()),
              })}
            </T>
          )}
          <View style={{ marginTop: 24 }}>
            <Button
              label={t("Remove friend")}
              danger
              onPress={() => {
                showFriend(null);
                onRemove(friend.id);
              }}
            />
          </View>
        </Sheet>
      )}
    </ScrollView>
  );
}
