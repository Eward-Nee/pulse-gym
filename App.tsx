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
  Sheet,
  T,
  Theme,
  palettes,
  useReducedMotion,
} from "./src/components/ui";
import {
  database,
  deleteWorkout,
  initDB,
  orderWorkouts,
  putWorkout,
  removeFriend,
  serial,
  snapshot,
  uid,
  updateSettings,
} from "./src/services/db";
import {
  canConnect,
  flush,
  respondChallenge,
  sendChallenge,
  startPeers,
} from "./src/services/peers";
import { cancelReminder, remind } from "./src/services/notifications";
import { getIdentity } from "./src/services/identity";
import { move, type Snapshot, type Workout } from "./src/core/model";
import Home from "./src/screens/Home";
import Challenges, { ChallengeBuilder } from "./src/screens/Challenges";
import Setup, { type Act } from "./src/screens/Setup";
import WorkoutEditor from "./src/screens/WorkoutEditor";
import SessionScreen, { type ActiveSession } from "./src/screens/SessionScreen";
import HyroxScreen from "./src/screens/HyroxScreen";
type Tab = "Home" | "Challenge" | "Setup";
function AppContent() {
  const [data, setData] = useState<Snapshot | null>(null),
    [tab, setTab] = useState<Tab>("Home"),
    [editor, setEditor] = useState<Workout | null>(null),
    [modal, setModal] = useState<"hyrox" | "challenge" | "history" | null>(
      null,
    ),
    [active, setActive] = useState<ActiveSession | null>(null),
    [showSession, setShowSession] = useState(false),
    [notice, setNotice] = useState(""),
    [fatal, setFatal] = useState(""),
    [busy, setBusy] = useState(false),
    [networkStatus, setNetworkStatus] = useState(
      Platform.OS === "web"
        ? "Blaaiervoorskou · geen direkte sockets"
        : "Verbinding word voorberei…",
    ),
    [confirm, setConfirm] = useState<{
      title: string;
      body: string;
      task: () => Promise<unknown>;
    } | null>(null);
  const reduced = useReducedMotion(),
    alive = useRef(true),
    syncing = useRef(false);
  const refresh = useCallback(async () => {
    const next = await snapshot();
    const row = await (
      await database()
    ).getFirstAsync<{ state: string }>(
      "SELECT state FROM active_session WHERE singleton=1",
    );
    if (alive.current) {
      setData(next);
      setActive(row ? JSON.parse(row.state) : null);
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
            ? "Blaaiervoorskou · gebruik die native bou vir koppeling"
            : "Direkte koppeling vereis ’n native bou, nie Expo Go nie.",
        );
        return;
      }
      try {
        const close = await startPeers(
          () => {
            void refresh();
          },
          (e) => setNetworkStatus("Verbindingsfout: " + e.message),
        );
        if (cancelled) close();
        else {
          stop = close;
          setNetworkStatus(
            "Luister vir direkte verbindings · hou albei apps oop",
          );
          void sync();
        }
      } catch (e) {
        setNetworkStatus((e as Error).message);
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
    setBusy(true);
    try {
      await serial(fn);
      await refresh();
      if (message) setNotice(message);
    } finally {
      setBusy(false);
    }
  };
  const act: Act = (fn, message) => {
    void mutate(fn, message).catch((e) => setNotice((e as Error).message));
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
          Kon nie plaaslike berging oopmaak nie.
        </Text>
        <Text style={{ color: "#cbb", marginTop: 20 }}>{fatal}</Text>
        <Text style={{ color: "#aaa", marginTop: 20 }}>
          Blaaier: gebruik die ingeslote server met
          cross-origin-isolation-headers. Jou data is nie verwyder nie.
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
          Maak jou plaaslike oefenruimte oop…
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
      await (
        await database()
      ).runAsync(
        "INSERT OR REPLACE INTO active_session VALUES(1,?)",
        JSON.stringify(next),
      );
      setActive(next);
      setShowSession(true);
    });
  };
  const importWorkouts = async (workouts: Workout[]) => {
    await mutate(async () => {
      const db = await database();
      await db.withTransactionAsync(async () => {
        for (let i = 0; i < workouts.length; i++)
          await putWorkout({
            ...workouts[i],
            position: data.workouts.length + i,
          });
      });
    }, "Workouts by jou versameling gevoeg.");
  };
  return (
    <Theme.Provider
      value={{ c, reduced: reduced || data.settings.reducedMotion }}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
        <StatusBar
          barStyle={
            data.settings.theme === "couples" ? "dark-content" : "light-content"
          }
        />
        <View
          style={{ flex: 1, width: "100%", maxWidth: 620, alignSelf: "center" }}
        >
          <View
            style={{ paddingHorizontal: 22, paddingTop: 14, paddingBottom: 10 }}
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
                  : "SOCIAL / LOCAL"}
              </Pill>
            </Row>
          </View>
          {!!notice && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Maak boodskap toe"
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
          {busy && <ActivityIndicator size="small" color={c.accent} />}
          <View style={{ flex: 1 }}>
            {tab === "Home" ? (
              <Home
                data={data}
                hasActive={!!active}
                onResume={() => setShowSession(true)}
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
                    title: "Skrap workout?",
                    body: `“${w.name}” word uit jou templates verwyder. Vorige sessies bly in geskiedenis.`,
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
                onChallenges={() => setTab("Challenge")}
                onHistory={() => setModal("history")}
              />
            ) : tab === "Challenge" ? (
              <Challenges
                data={data}
                onNew={() => setModal("challenge")}
                onSync={() => {
                  if (!canConnect())
                    setNotice("Direkte sinkronisering benodig die native bou.");
                  else {
                    setNotice("Probeer direkte aflewering…");
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
                  }, "Status gestoor; bevestiging in uitboks.")
                }
              />
            ) : (
              <Setup
                data={data}
                act={act}
                onHyrox={() => setModal("hyrox")}
                networkStatus={networkStatus}
                onRemove={(id) =>
                  setConfirm({
                    title: "Verwyder vriend?",
                    body: "Die verbinding, gedeelde kopieë, challenges en enige partner-keuse vir hierdie vriend word plaaslik verwyder.",
                    task: () => removeFriend(id),
                  })
                }
                onImport={(w) => {
                  void importWorkouts([w]).catch((e) => setNotice(e.message));
                }}
              />
            )}
          </View>
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
                  onPress={() => setTab(name)}
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
                    {name}
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
              await mutate(() => putWorkout(w), "Workout gestoor.");
              setEditor(null);
            }}
          />
        )}
        {modal === "challenge" && (
          <ChallengeBuilder
            data={data}
            onClose={() => setModal(null)}
            onSend={(c) =>
              mutate(() => sendChallenge(c), "Challenge in uitboks.")
            }
          />
        )}
        {modal === "hyrox" && (
          <HyroxScreen
            settings={data.settings}
            onClose={() => setModal(null)}
            onSettings={(s) =>
              mutate(() => updateSettings(s), "Wedreninstellings gestoor.")
            }
            onImport={importWorkouts}
          />
        )}
        {modal === "history" && (
          <Sheet title="Jou geskiedenis" onClose={() => setModal(null)}>
            {data.sessions.length ? (
              data.sessions.map((s) => (
                <Card key={s.id}>
                  <Label>
                    {new Date(s.finishedAt).toLocaleDateString("af-ZA")}
                  </Label>
                  <T size={18} bold>
                    {s.name}
                  </T>
                  <T muted>
                    {Math.round(s.seconds / 60)} min ·{" "}
                    {Object.values(s.completedSets).reduce((a, b) => a + b, 0)}{" "}
                    stelle
                  </T>
                  {s.exercises.map((e) => (
                    <T key={e.id} muted size={12} style={{ marginTop: 6 }}>
                      {e.name}: {s.completedSets[e.id] || 0}/{e.sets} stelle
                      {e.kind === "strength" ? ` · ${e.kg} kg` : ""}
                    </T>
                  ))}
                </Card>
              ))
            ) : (
              <T muted>
                Voltooi jou eerste sessie om jou geskiedenis te begin.
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
            onFinish={() => {
              setShowSession(false);
              setActive(null);
              void refresh();
              setNotice("Sessie in jou geskiedenis gestoor.");
            }}
          />
        )}
        {confirm && (
          <Sheet title={confirm.title} onClose={() => setConfirm(null)}>
            <T style={{ marginBottom: 22 }}>{confirm.body}</T>
            <Row>
              <Button label="Kanselleer" onPress={() => setConfirm(null)} />
              <Button
                label="Ja, verwyder"
                danger
                onPress={() => {
                  act(confirm.task, "Verwyder.");
                  setConfirm(null);
                }}
              />
            </Row>
          </Sheet>
        )}
      </SafeAreaView>
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
