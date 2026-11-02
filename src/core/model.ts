export type ExerciseKind = "strength" | "bodyweight" | "run" | "time";
export type Exercise = {
  id: string;
  name: string;
  kind: ExerciseKind;
  sets: number;
  reps: number;
  kg: number;
  seconds: number;
  meters: number;
  rest: number;
  notes: string;
};
export type Workout = {
  id: string;
  name: string;
  exercises: Exercise[];
  position: number;
  notes: string;
};
export type Session = {
  id: string;
  name: string;
  finishedAt: number;
  seconds: number;
  exercises: Exercise[];
  completedSets: Record<string, number>;
};
export type Friend = {
  id: string;
  name: string;
  publicKey: string;
  host: string;
  port: number;
  status: "pending" | "accepted";
  verified: number;
  shareTemplates: number;
  shareHistory: number;
  templates: Workout[];
  history: Session[];
  syncedAt: number;
};
export type Challenge = {
  id: string;
  friendId: string;
  title: string;
  kind: "run" | "exercise" | "workout";
  target: number;
  deadline: number;
  createdAt: number;
  direction: "incoming" | "outgoing";
  status: "invited" | "accepted" | "completed" | "declined";
  delivered: number;
};
export type Settings = {
  name: string;
  theme: "pulse" | "couples";
  wallpaper: "iron" | "steel" | "plain";
  reducedMotion: boolean;
  raceDate: string;
  level: "foundation" | "regular";
  trainingDays: 3 | 4 | 5;
  repo: string;
};
export type Snapshot = {
  workouts: Workout[];
  friends: Friend[];
  challenges: Challenge[];
  sessions: Session[];
  settings: Settings;
  partnerId: string | null;
  pendingCount: number;
};
export const DEFAULT_SETTINGS: Settings = {
  name: "Atleet",
  theme: "pulse",
  wallpaper: "iron",
  reducedMotion: false,
  raceDate: "",
  level: "foundation",
  trainingDays: 3,
  repo: "",
};
export const DURATIONS = [
  { label: "1 uur", hours: 1 },
  { label: "2 ure", hours: 2 },
  { label: "4 ure", hours: 4 },
  { label: "8 ure", hours: 8 },
  { label: "1 dag", hours: 24 },
  { label: "2 dae", hours: 48 },
  { label: "3 dae", hours: 72 },
  { label: "1 week", hours: 168 },
];
export function challengeState(c: Challenge, now = Date.now()) {
  return (c.status === "invited" || c.status === "accepted") &&
    now >= c.deadline
    ? "expired"
    : c.status;
}
export function validateWorkout(w: Workout) {
  if (
    !w ||
    typeof w.id !== "string" ||
    w.id.length > 80 ||
    typeof w.name !== "string" ||
    !w.name.trim() ||
    w.name.length > 80
  )
    throw new Error("Gee die workout ’n naam van 1–80 karakters.");
  if (
    !Array.isArray(w.exercises) ||
    !w.exercises.length ||
    w.exercises.length > 60
  )
    throw new Error("Kies 1–60 oefeninge.");
  if (typeof w.notes !== "string" || w.notes.length > 4000)
    throw new Error("Workout-notas is ongeldig.");
  const ids = new Set<string>();
  for (const e of w.exercises) {
    if (
      !e ||
      typeof e.id !== "string" ||
      e.id.length > 80 ||
      typeof e.name !== "string" ||
      typeof e.notes !== "string" ||
      e.notes.length > 4000
    )
      throw new Error("Ongeldige oefeninginhoud.");
    if (ids.has(e.id)) throw new Error("Duplikaat-oefening ID.");
    ids.add(e.id);
    if (!e.name.trim() || e.name.length > 80)
      throw new Error("Elke oefening benodig ’n naam.");
    if (!["strength", "bodyweight", "run", "time"].includes(e.kind))
      throw new Error("Ongeldige oefeningsoort.");
    if (!Number.isInteger(e.sets) || e.sets < 1 || e.sets > 100)
      throw new Error("Stelle moet tussen 1 en 100 wees.");
    for (const n of [e.reps, e.kg, e.seconds, e.meters, e.rest])
      if (!Number.isFinite(n) || n < 0 || n > 100000)
        throw new Error("Gebruik geldige positiewe oefenwaardes.");
    if (!Number.isInteger(e.reps))
      throw new Error("Reps moet heelgetalle wees.");
    if ((e.kind === "strength" || e.kind === "bodyweight") && e.reps < 1)
      throw new Error("Voeg reps by.");
    if (
      (e.kind === "run" || e.kind === "time") &&
      e.seconds <= 0 &&
      e.meters <= 0
    )
      throw new Error("Voeg tyd of afstand by.");
  }
  return w;
}
export function dateOnly(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function parseDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new Error("Gebruik JJJJ-MM-DD.");
  const d = new Date(value + "T12:00:00");
  if (!Number.isFinite(+d) || dateOnly(d) !== value)
    throw new Error("Ongeldige datum.");
  return d;
}
export function daysUntil(value: string, now = new Date()) {
  const d = parseDate(value);
  return Math.round(
    (Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) -
      Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) /
      86400000,
  );
}
export function move<T>(items: T[], from: number, to: number) {
  const next = [...items];
  if (from < 0 || to < 0 || from >= next.length || to >= next.length)
    return next;
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
export const EXERCISE_LABELS = {
  strength: "Gewig",
  bodyweight: "Liggaamsgewig",
  run: "Draf / afstand",
  time: "Tyd",
};
export function exerciseSummary(e: Exercise) {
  return `${e.sets} × ${e.kind === "strength" || e.kind === "bodyweight" ? e.reps + " reps" : e.meters ? e.meters + " m" : Math.round(e.seconds / 60) + " min"}${e.kind === "strength" ? " · " + e.kg + " kg" : ""}${e.rest ? " · " + e.rest + "s rus" : ""}`;
}
