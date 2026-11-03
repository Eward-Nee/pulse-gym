import * as SQLite from "expo-sqlite";
import * as Crypto from "expo-crypto";
import { SCHEMA, SCHEMA_VERSION } from "../core/schema";
import { t, isLanguage } from "../i18n";
import {
  DEFAULT_SETTINGS,
  WALLPAPERS,
  validateWorkout,
  type Snapshot,
  type Workout,
  type Settings,
  type Friend,
  type Session,
  type Challenge,
  type ActiveSession,
} from "../core/model";
export const uid = () => Crypto.randomUUID();
let opening: Promise<SQLite.SQLiteDatabase> | null = null;
let queue: Promise<unknown> = Promise.resolve();
/**
 * Every statement runs on one connection, and withTransactionAsync pulls in any
 * query that happens to run meanwhile. Queue all DB work (reads included) here so
 * a read can never observe, or join, someone else's half-finished transaction.
 * Never call serial() from inside a serial() task: it would wait on itself.
 */
export function serial<T>(fn: () => Promise<T>): Promise<T> {
  const p = queue.then(fn);
  queue = p.catch(() => {});
  return p;
}
export function database() {
  // Cache the promise, not the result: concurrent first calls must share one connection.
  opening ??= SQLite.openDatabaseAsync("pulse-gym.db").catch((e) => {
    opening = null;
    throw e;
  });
  return opening;
}
function parse<T>(text: unknown, fallback: T): T {
  try {
    return JSON.parse(String(text)) ?? fallback;
  } catch {
    return fallback;
  }
}
let initializing: Promise<void> | null = null;
export function initDB() {
  initializing ??= serial(setup).catch((e) => {
    initializing = null;
    throw e;
  });
  return initializing;
}
async function setup() {
  const d = await database();
  await d.execAsync(SCHEMA);
  const version =
    (await d.getFirstAsync<{ user_version: number }>("PRAGMA user_version"))
      ?.user_version ?? 0;
  // Future schema changes: add `if (version < 2) {...}` steps here, then bump SCHEMA_VERSION.
  if (version < SCHEMA_VERSION)
    await d.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  await d.withTransactionAsync(async () => {
    // Profile and the starter workouts are created together or not at all.
    const created = await d.runAsync(
      "INSERT OR IGNORE INTO profile(singleton,settings) VALUES(1,?)",
      JSON.stringify(DEFAULT_SETTINGS),
    );
    if (!created.changes) return;
    const workouts: Workout[] = [
      {
        id: uid(),
        name: t("Full body · Foundation"),
        position: 0,
        notes: t(
          "Choose your own training weights. 0 kg means the weight has not been chosen yet.",
        ),
        exercises: [
          {
            id: uid(),
            name: t("Goblet squat"),
            kind: "strength",
            sets: 3,
            reps: 8,
            kg: 0,
            seconds: 0,
            meters: 0,
            rest: 90,
            notes: t("Keep 2–3 reps in reserve."),
          },
          {
            id: uid(),
            name: t("Push-ups"),
            kind: "bodyweight",
            sets: 3,
            reps: 8,
            kg: 0,
            seconds: 0,
            meters: 0,
            rest: 60,
            notes: t("Use a raised surface if needed."),
          },
        ],
      },
      {
        id: uid(),
        name: t("Easy run · Your pace"),
        position: 1,
        notes: t("Conversation pace. Walk where needed."),
        exercises: [
          {
            id: uid(),
            name: t("Walk / jog"),
            kind: "time",
            sets: 1,
            reps: 0,
            kg: 0,
            seconds: 1200,
            meters: 0,
            rest: 0,
            notes: "",
          },
        ],
      },
    ];
    for (const w of workouts) await putWorkout(w);
  });
}
const decodeWorkout = (r: any): Workout => ({
  ...r,
  exercises: parse(r.exercises, []),
});
const decodeFriend = (r: any): Friend => ({
  ...r,
  templates: parse(r.templates, []),
  history: parse(r.history, []),
});
/** Unqueued read: for use inside a serial() task. Elsewhere use load(). */
export async function snapshot(): Promise<Snapshot> {
  const d = await database();
  const [w, f, c, h, p, o] = await Promise.all([
    d.getAllAsync<any>("SELECT * FROM workouts ORDER BY position,id"),
    d.getAllAsync<any>("SELECT * FROM friends ORDER BY name"),
    d.getAllAsync<Challenge>(
      "SELECT * FROM challenges ORDER BY createdAt DESC",
    ),
    d.getAllAsync<any>(
      "SELECT * FROM sessions ORDER BY finishedAt DESC LIMIT 100",
    ),
    d.getFirstAsync<any>("SELECT * FROM profile WHERE singleton=1"),
    d.getFirstAsync<any>("SELECT count(*) as n FROM outbox"),
  ]);
  const settings = {
    ...DEFAULT_SETTINGS,
    ...parse<Partial<Settings>>(p?.settings, {}),
  };
  if (!isLanguage(settings.language))
    settings.language = DEFAULT_SETTINGS.language;
  if (!(WALLPAPERS as readonly string[]).includes(settings.wallpaper))
    settings.wallpaper = DEFAULT_SETTINGS.wallpaper;
  return {
    workouts: w.map(decodeWorkout),
    friends: f.map(decodeFriend),
    challenges: c,
    sessions: h.map((x) => ({
      ...x,
      exercises: parse(x.exercises, []),
      completedSets: parse(x.completedSets, {}),
    })),
    settings,
    partnerId: p?.partnerId ?? null,
    pendingCount: o?.n ?? 0,
  };
}
async function readActive(): Promise<ActiveSession | null> {
  const row = await (
    await database()
  ).getFirstAsync<{ state: string }>(
    "SELECT state FROM active_session WHERE singleton=1",
  );
  const state = row ? parse<ActiveSession | null>(row.state, null) : null;
  return state?.workout && Array.isArray(state.workout.exercises)
    ? state
    : null;
}
/** One consistent, queued read of everything the UI shows. */
export function load() {
  return serial(async () => ({
    data: await snapshot(),
    active: await readActive(),
  }));
}
export async function saveActiveSession(state: ActiveSession) {
  await (
    await database()
  ).runAsync(
    "INSERT OR REPLACE INTO active_session VALUES(1,?)",
    JSON.stringify(state),
  );
}
export async function clearActiveSession() {
  await (await database()).runAsync("DELETE FROM active_session");
}
export async function putWorkout(w: Workout) {
  validateWorkout(w);
  // New workouts go to the end; positions of existing ones are owned by orderWorkouts.
  await (
    await database()
  ).runAsync(
    "INSERT INTO workouts(id,name,exercises,position,notes) VALUES(?,?,?,(SELECT COALESCE(MAX(position)+1,0) FROM workouts),?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, exercises=excluded.exercises,notes=excluded.notes",
    w.id,
    w.name.trim(),
    JSON.stringify(w.exercises),
    w.notes,
  );
}
export async function deleteWorkout(id: string) {
  const d = await database();
  await d.withTransactionAsync(async () => {
    await d.runAsync("DELETE FROM workouts WHERE id=?", id);
    // Close the gap so positions stay 0..n-1 and new workouts never collide.
    await d.runAsync(
      "UPDATE workouts SET position=(SELECT COUNT(*) FROM workouts o WHERE o.position<workouts.position OR (o.position=workouts.position AND o.id<workouts.id))",
    );
  });
}
export async function orderWorkouts(ids: string[]) {
  const d = await database();
  await d.withTransactionAsync(async () => {
    for (let i = 0; i < ids.length; i++)
      await d.runAsync("UPDATE workouts SET position=? WHERE id=?", i, ids[i]);
  });
}
export async function updateSettings(changes: Partial<Settings>) {
  const d = await database();
  const current = await d.getFirstAsync<{ settings: string }>(
    "SELECT settings FROM profile WHERE singleton=1",
  );
  const s = {
    ...DEFAULT_SETTINGS,
    ...JSON.parse(current?.settings || "{}"),
    ...changes,
  };
  await d.runAsync(
    "UPDATE profile SET settings=? WHERE singleton=1",
    JSON.stringify(s),
  );
}
export async function setPartner(id: string | null) {
  await (
    await database()
  ).runAsync("UPDATE profile SET partnerId=? WHERE singleton=1", id);
}
export async function removeFriend(id: string) {
  await (await database()).runAsync("DELETE FROM friends WHERE id=?", id);
}
export async function permissions(
  id: string,
  templates: boolean,
  history: boolean,
) {
  await (
    await database()
  ).runAsync(
    "UPDATE friends SET shareTemplates=?,shareHistory=? WHERE id=?",
    +templates,
    +history,
    id,
  );
}
export async function storeSession(s: Session) {
  await (
    await database()
  ).runAsync(
    "INSERT INTO sessions VALUES(?,?,?,?,?,?)",
    s.id,
    s.name,
    s.finishedAt,
    s.seconds,
    JSON.stringify(s.exercises),
    JSON.stringify(s.completedSets),
  );
}
export async function putChallenge(c: Challenge) {
  await (
    await database()
  ).runAsync(
    "INSERT INTO challenges(id,friendId,title,kind,target,deadline,createdAt,direction,status,delivered) VALUES(?,?,?,?,?,?,?,?,?,?)",
    c.id,
    c.friendId,
    c.title,
    c.kind,
    c.target,
    c.deadline,
    c.createdAt,
    c.direction,
    c.status,
    c.delivered,
  );
}
export async function findFriend(id: string): Promise<Friend | null> {
  const r = await (
    await database()
  ).getFirstAsync<any>("SELECT * FROM friends WHERE id=?", id);
  return r ? decodeFriend(r) : null;
}
