import * as SQLite from "expo-sqlite";
import * as Crypto from "expo-crypto";
import { SCHEMA } from "../core/schema";
import {
  DEFAULT_SETTINGS,
  validateWorkout,
  type Snapshot,
  type Workout,
  type Settings,
  type Friend,
  type Session,
  type Challenge,
} from "../core/model";
export const uid = () => Crypto.randomUUID();
let db: SQLite.SQLiteDatabase;
let queue: Promise<unknown> = Promise.resolve();
export function serial<T>(fn: () => Promise<T>): Promise<T> {
  const p = queue.then(fn);
  queue = p.catch(() => {});
  return p;
}
export async function database() {
  if (!db) db = await SQLite.openDatabaseAsync("pulse-gym.db");
  return db;
}
export async function initDB() {
  const d = await database();
  await d.execAsync(SCHEMA);
  const exists = await d.getFirstAsync(
    "SELECT singleton FROM profile WHERE singleton=1",
  );
  if (!exists) {
    await d.runAsync(
      "INSERT INTO profile(singleton,settings) VALUES(1,?)",
      JSON.stringify(DEFAULT_SETTINGS),
    );
    const workouts: Workout[] = [
      {
        id: uid(),
        name: "Full body · Foundation",
        position: 0,
        notes:
          "Kies jou eie oefengewigte. 0 kg beteken die gewig is nog nie gekies nie.",
        exercises: [
          {
            id: uid(),
            name: "Goblet squat",
            kind: "strength",
            sets: 3,
            reps: 8,
            kg: 0,
            seconds: 0,
            meters: 0,
            rest: 90,
            notes: "Hou 2–3 reps in reserwe.",
          },
          {
            id: uid(),
            name: "Push-ups",
            kind: "bodyweight",
            sets: 3,
            reps: 8,
            kg: 0,
            seconds: 0,
            meters: 0,
            rest: 60,
            notes: "Gebruik ’n verhewe oppervlak indien nodig.",
          },
        ],
      },
      {
        id: uid(),
        name: "Easy run · Jou tempo",
        position: 1,
        notes: "Geselstempo. Stap waar nodig.",
        exercises: [
          {
            id: uid(),
            name: "Stap / draf",
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
  }
}
const decodeWorkout = (r: any): Workout => ({
  ...r,
  exercises: JSON.parse(r.exercises),
});
const decodeFriend = (r: any): Friend => ({
  ...r,
  templates: JSON.parse(r.templates),
  history: JSON.parse(r.history),
});
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
  return {
    workouts: w.map(decodeWorkout),
    friends: f.map(decodeFriend),
    challenges: c,
    sessions: h.map((x) => ({
      ...x,
      exercises: JSON.parse(x.exercises),
      completedSets: JSON.parse(x.completedSets),
    })),
    settings: { ...DEFAULT_SETTINGS, ...JSON.parse(p.settings) },
    partnerId: p.partnerId,
    pendingCount: o.n,
  };
}
export async function putWorkout(w: Workout) {
  validateWorkout(w);
  await (
    await database()
  ).runAsync(
    "INSERT INTO workouts(id,name,exercises,position,notes) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, exercises=excluded.exercises,position=excluded.position,notes=excluded.notes",
    w.id,
    w.name.trim(),
    JSON.stringify(w.exercises),
    w.position,
    w.notes,
  );
}
export async function deleteWorkout(id: string) {
  await (await database()).runAsync("DELETE FROM workouts WHERE id=?", id);
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
