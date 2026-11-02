import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Image,
  Platform,
  Pressable,
  StatusBar,
  Text,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  Button,
  Card,
  Field,
  Heading,
  Label,
  Pill,
  Row,
  ScreenTransition,
  Sheet,
  T,
  Theme,
  palettes,
  useReducedMotion,
} from "./src/components/ui";
import {
  clearActiveSession,
  deleteWorkout,
  initDB,
  load,
  orderWorkouts,
  putWorkout,
  removeFriend,
  saveActiveSession,
  serial,
  uid,
  updateSettings,
} from "./src/services/db";
import { locale, setLanguage, t, tn } from "./src/i18n";
import {
  canConnect,
  flush,
  respondChallenge,
  sendChallenge,
  startPeers,
} from "./src/services/peers";
import { cancelReminder, remind } from "./src/services/notifications";
import { getIdentity } from "./src/services/identity";
import {
  move,
  type ActiveSession,
  type Snapshot,
  type Workout,
} from "./src/core/model";
import Home from "./src/screens/Home";
import Challenges, { ChallengeBuilder } from "./src/screens/Challenges";
import Setup, { type Act } from "./src/screens/Setup";
import WorkoutEditor from "./src/screens/WorkoutEditor";
import SessionScreen from "./src/screens/SessionScreen";
import HyroxScreen from "./src/screens/HyroxScreen";
type Tab = "Home" | "Challenge" | "Setup";
const TABS: Tab[] = ["Home", "Challenge", "Setup"];
type Status = { text: string; vars?: Record<string, string | number> };
function AppContent() {
  const [data, setData] = useState<Snapshot | null>(null),
    [tab, setTab] = useState<Tab>("Home"),
    [direction, setDirection] = useState(1),
    [editor, setEditor] = useState<Workout | null>(null),
    [modal, setModal] = useState<"hyrox" | "challenge" | "history" | null>(
      null,
    ),
    [active, setActive] = useState<ActiveSession | null>(null),
    [showSession, setShowSession] = useState(false),
    [notice, setNotice] = useState(""),
    [fatal, setFatal] = useState(""),
    [pending, setPending] = useState(0),
    [networkStatus, setNetworkStatus] = useState<Status>({
      text:
        Platform.OS === "web"
          ? "Browser preview · no direct sockets"
          : "Preparing connection…",
    }),
    [confirm, setConfirm] = useState<{
      title: string;
      body: string;
      confirmLabel: string;
      done: string;
      task: () => Promise<unknown>;
    } | null>(null);
  const reduced = useReducedMotion(),
    alive = useRef(true),
    syncing = useRef(false);
  const refresh = useCallback(async () => {
    // One queued, consistent read: results arrive in the order they were requested.
    const next = await load();
    if (alive.current) {
      setData(next.data);
      setActive(next.active);
    }
  }, []);
  useEffect(() => {
    alive.current = true;
    void (async () => {
      try {
        await initDB();
        await getIdentity();
        await refresh();
      } catch (e) {
        setFatal((e as Error).message);
      }
    })();
    return () => {
      alive.current = false;
    };
  }, [refresh]);
  const sync = useCallback(async () => {
    if (syncing.current) return;
    syncing.current = true;
    try {
      await flush();
      await refresh();
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      syncing.current = false;
    }
  }, [refresh]);
  useEffect(() => {
    if (!data) return;
    let stop: (() => void) | undefined,
      cancelled = false;
    async function start() {
      if (!canConnect()) {
        setNetworkStatus(
          Platform.OS === "web"
            ? { text: "Browser preview · use the native build to connect" }
            : { text: "Direct connection needs a native build, not Expo Go." },
        );
        return;
      }
      try {
        const close = await startPeers(
          () => {
            void refresh();
          },
          (e) =>
            setNetworkStatus({
              text: "Connection error: {message}",
              vars: { message: e.message },
            }),
        );
        if (cancelled) close();
        else {
          stop = close;
          setNetworkStatus({
            text: "Listening for direct connections · keep both apps open",
          });
          void sync();
        }
      } catch (e) {
        setNetworkStatus({
          text: "{message}",
          vars: { message: (e as Error).message },
        });
      }
    }
    void start();
    const timer = setInterval(() => {
      if (AppState.currentState === "active") void sync();
    }, 20000);
    const app = AppState.addEventListener("change", (state) => {
      if (state === "active") void sync();
    });
    return () => {
      cancelled = true;
      stop?.();
      clearInterval(timer);
      app.remove();
    };
  }, [!!data, refresh, sync]);
  useEffect(() => {
    if (data?.pendingCount) void sync();
  }, [data?.pendingCount, sync]);
  const mutate = async (fn: () => Promise<unknown>, message?: string) => {
    setPending((n) => n + 1);
    try {
      await serial(fn);
      await refresh();
      if (message) setNotice(message);
    } finally {
      setPending((n) => n - 1);
    }
  };
  const act: Act = (fn, message) => {
    void mutate(fn, message).catch((e) => setNotice((e as Error).message));
  };
  // Strings are looked up by t() at render time; the content below is re-keyed by language.
  setLanguage(data?.settings.language ?? "en");
  const go = (next: Tab) => {
    if (next === tab) return;
    setDirection(TABS.indexOf(next) > TABS.indexOf(tab) ? 1 : -1);
    setTab(next);
  };
  const c =
    data?.settings.theme === "couples" ? palettes.couples : palettes.pulse;
  if (fatal)
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#111217",
          padding: 30,
          justifyContent: "center",
        }}
      >
        <Text style={{ color: "#fff", fontSize: 22 }}>
          {t("Could not open local storage.")}
        </Text>
        <Text style={{ color: "#cbb", marginTop: 20 }}>{fatal}</Text>
        <Text style={{ color: "#aaa", marginTop: 20 }}>
          {t(
            "Browser: use the bundled server with cross-origin-isolation headers. Your data has not been removed.",
          )}
        </Text>
      </View>
    );
  if (!data)
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#111217",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Image
          source={require("./assets/icon.png")}
          style={{ width: 74, height: 74, borderRadius: 20, marginBottom: 24 }}
        />
        <ActivityIndicator color="#ff978b" />
        <Text style={{ color: "#aaa", marginTop: 16 }}>
          {t("Opening your local training space…")}
        </Text>
      </View>
    );
  const start = (w: Workout) => {
    if (active) {
      setShowSession(true);
      return;
    }
    act(async () => {
      const next = {
        workout: JSON.parse(JSON.stringify(w)),
        startedAt: Date.now(),
        completedSets: {},
      };
      await saveActiveSession(next);
      setActive(next);
      setShowSession(true);
    });
  };
  const cancelActive = () =>
    mutate(() => clearActiveSession(), t("Workout cancelled.")).then(() =>
      setShowSession(false),
    );
  const importWorkouts = async (workouts: Workout[]) => {
    // putWorkout appends new workouts at the end, in call order.
    await mutate(async () => {
      for (const w of workouts) await putWorkout(w);
    }, t("Workouts added to your collection."));
  };
  return (
    <Theme.Provider
      value={{ c, reduced: reduced || data.settings.reducedMotion }}
    >
      <View key={data.settings.language} style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
          <StatusBar
            barStyle={
              data.settings.theme === "couples"
                ? "dark-content"
                : "light-content"
            }
          />
          <View
            style={{
              flex: 1,
              width: "100%",
              maxWidth: 620,
              alignSelf: "center",
            }}
          >
            <View
              style={{
                paddingHorizontal: 22,
                paddingTop: 14,
                paddingBottom: 10,
              }}
            >
              <Row style={{ justifyContent: "space-between" }}>
                <Row>
                  <Image
                    source={require("./assets/icon.png")}
                    style={{ width: 28, height: 28, borderRadius: 8 }}
                  />
                  <Text
                    style={{
                      color: c.text,
                      fontSize: 13,
                      letterSpacing: 3,
                      fontWeight: "800",
                    }}
                  >
                    PULSE <Text style={{ color: c.accent }}>GYM</Text>
                  </Text>
                </Row>
                <Pill>
                  {data.settings.theme === "couples"
                    ? "♥ TOGETHER"
                    : t("SOCIAL / LOCAL")}
                </Pill>
              </Row>
            </View>
            {!!notice && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("Dismiss message")}
                onPress={() => setNotice("")}
                style={{
                  marginHorizontal: 22,
                  marginVertical: 6,
                  backgroundColor: c.soft,
                  padding: 12,
                  borderRadius: 12,
                }}
              >
                <T size={12}>{notice} ×</T>
              </Pressable>
            )}
            {pending > 0 && <ActivityIndicator size="small" color={c.accent} />}
            <ScreenTransition key={tab} direction={direction}>
              {tab === "Home" ? (
                <Home
                  data={data}
                  hasActive={!!active}
                  onResume={() => setShowSession(true)}
                  onCancelActive={() =>
                    setConfirm({
                      title: t("Cancel this workout?"),
                      body: t(
                        "Your progress in this session is discarded and nothing is added to your history.",
                      ),
                      confirmLabel: t("Yes, cancel workout"),
                      done: t("Workout cancelled."),
                      task: clearActiveSession,
                    })
                  }
                  onEdit={setEditor}
                  onNew={() =>
                    setEditor({
                      id: uid(),
                      name: "",
                      exercises: [],
                      position: data.workouts.length,
                      notes: "",
                    })
                  }
                  onStart={start}
                  onDelete={(w) =>
                    setConfirm({
                      title: t("Delete workout?"),
                      body: t(
                        "“{name}” will be removed from your templates. Past sessions stay in your history.",
                        { name: w.name },
                      ),
                      confirmLabel: t("Yes, remove"),
                      done: t("Removed."),
                      task: () => deleteWorkout(w.id),
                    })
                  }
                  onMove={(w, d) =>
                    act(() =>
                      orderWorkouts(
                        move(
                          data.workouts,
                          data.workouts.findIndex((x) => x.id === w.id),
                          data.workouts.findIndex((x) => x.id === w.id) + d,
                        ).map((x) => x.id),
                      ),
                    )
                  }
                  onHyrox={() => setModal("hyrox")}
                  onChallenges={() => go("Challenge")}
                  onHistory={() => setModal("history")}
                />
              ) : tab === "Challenge" ? (
                <Challenges
                  data={data}
                  onNew={() => setModal("challenge")}
                  onSync={() => {
                    if (!canConnect())
                      setNotice(t("Direct sync needs the native build."));
                    else {
                      setNotice(t("Trying direct delivery…"));
                      void sync();
                    }
                  }}
                  onRespond={(challenge, status) =>
                    act(async () => {
                      await respondChallenge(challenge, status);
                      if (status === "accepted")
                        await remind(
                          challenge.id,
                          challenge.deadline,
                          challenge.title,
                        );
                      else await cancelReminder(challenge.id);
                    }, t("Status saved; confirmation in outbox."))
                  }
                />
              ) : (
                <Setup
                  data={data}
                  act={act}
                  onHyrox={() => setModal("hyrox")}
                  networkStatus={t(networkStatus.text, networkStatus.vars)}
                  onRemove={(id) =>
                    setConfirm({
                      title: t("Remove friend?"),
                      body: t(
                        "The connection, shared copies, challenges and any partner choice for this friend are removed locally.",
                      ),
                      confirmLabel: t("Yes, remove"),
                      done: t("Removed."),
                      task: () => removeFriend(id),
                    })
                  }
                  onImport={(w) => {
                    void importWorkouts([w]).catch((e) => setNotice(e.message));
                  }}
                />
              )}
            </ScreenTransition>
            <View
              style={{
                paddingHorizontal: 22,
                paddingTop: 8,
                paddingBottom: Platform.OS === "web" ? 16 : 5,
              }}
            >
              <View
                style={{
                  backgroundColor: c.surface,
                  borderRadius: 28,
                  padding: 5,
                  flexDirection: "row",
                  borderWidth: 1,
                  borderColor: c.line,
                }}
              >
                {(
                  [
                    ["Home", "home-outline"],
                    ["Challenge", "flash-outline"],
                    ["Setup", "options-outline"],
                  ] as const
                ).map(([name, icon]) => (
                  <Pressable
                    accessibilityRole="tab"
                    accessibilityState={{ selected: tab === name }}
                    key={name}
                    onPress={() => go(name)}
                    style={{
                      flex: 1,
                      borderRadius: 24,
                      backgroundColor: tab === name ? c.accent : "transparent",
                      alignItems: "center",
                      paddingVertical: 11,
                      gap: 4,
                    }}
                  >
                    <Ionicons
                      name={icon}
                      size={20}
                      color={tab === name ? c.on : c.muted}
                    />
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "700",
                        color: tab === name ? c.on : c.muted,
                      }}
                    >
                      {t(name)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
          {editor && (
            <WorkoutEditor
              workout={editor}
              onClose={() => setEditor(null)}
              onSave={async (w) => {
                await mutate(() => putWorkout(w), t("Workout saved."));
                setEditor(null);
              }}
            />
          )}
          {modal === "challenge" && (
            <ChallengeBuilder
              data={data}
              onClose={() => setModal(null)}
              onSend={(c) =>
                mutate(() => sendChallenge(c), t("Challenge in outbox."))
              }
            />
          )}
          {modal === "hyrox" && (
            <HyroxScreen
              settings={data.settings}
              onClose={() => setModal(null)}
              onSettings={(s) =>
                mutate(() => updateSettings(s), t("Race settings saved."))
              }
              onImport={importWorkouts}
            />
          )}
          {modal === "history" && (
            <Sheet title={t("Your history")} onClose={() => setModal(null)}>
              {data.sessions.length ? (
                data.sessions.map((s) => (
                  <Card key={s.id}>
                    <Label>
                      {new Date(s.finishedAt).toLocaleDateString(locale())}
                    </Label>
                    <T size={18} bold>
                      {s.name}
                    </T>
                    <T muted>
                      {Math.round(s.seconds / 60)} min ·{" "}
                      {tn(
                        Object.values(s.completedSets).reduce(
                          (a, b) => a + b,
                          0,
                        ),
                        "{n} set",
                        "{n} sets",
                      )}
                    </T>
                    {s.exercises.map((e) => (
                      <T key={e.id} muted size={12} style={{ marginTop: 6 }}>
                        {e.name}: {s.completedSets[e.id] || 0}/{e.sets}{" "}
                        {t("sets")}
                        {e.kind === "strength" ? ` · ${e.kg} kg` : ""}
                      </T>
                    ))}
                  </Card>
                ))
              ) : (
                <T muted>
                  {t("Finish your first session to start your history.")}
                </T>
              )}
            </Sheet>
          )}
          {showSession && active && (
            <SessionScreen
              initial={active}
              onClose={() => {
                void refresh()
                  .then(() => setShowSession(false))
                  .catch((e) => setNotice(e.message));
              }}
              onCancel={cancelActive}
              onFinish={() => {
                setShowSession(false);
                setActive(null);
                void refresh();
                setNotice(t("Session saved to your history."));
              }}
            />
          )}
          {confirm && (
            <Sheet title={confirm.title} onClose={() => setConfirm(null)}>
              <T style={{ marginBottom: 22 }}>{confirm.body}</T>
              <Row>
                <Button label={t("Go back")} onPress={() => setConfirm(null)} />
                <Button
                  label={confirm.confirmLabel}
                  danger
                  onPress={() => {
                    act(confirm.task, confirm.done);
                    setConfirm(null);
                  }}
                />
              </Row>
            </Sheet>
          )}
        </SafeAreaView>
      </View>
    </Theme.Provider>
  );
}
export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}
