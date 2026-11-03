import { t, DEFAULT_LANGUAGE, type Language } from "../i18n";
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
export type ActiveSession = {
  workout: Workout;
  startedAt: number;
  completedSets: Record<string, number>;
};
export const WALLPAPERS = ["iron", "steel", "rose", "plain"] as const;
export type WallpaperId = (typeof WALLPAPERS)[number];
export type Settings = {
  name: string;
  language: Language;
  theme: "pulse" | "couples";
  wallpaper: WallpaperId;
  reducedMotion: boolean;
  raceDate: string;
  level: "foundation" | "regular";
  trainingDays: 3 | 4 | 5;
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
  name: "Athlete",
  language: DEFAULT_LANGUAGE,
  theme: "pulse",
  wallpaper: "iron",
  reducedMotion: false,
  raceDate: "",
  level: "foundation",
  trainingDays: 3,
};
/** `label` is an English i18n key; translate with t() when rendering. */
export const DURATIONS = [
  { label: "1 hour", hours: 1 },
  { label: "2 hours", hours: 2 },
  { label: "4 hours", hours: 4 },
  { label: "8 hours", hours: 8 },
  { label: "1 day", hours: 24 },
  { label: "2 days", hours: 48 },
  { label: "3 days", hours: 72 },
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
    throw new Error(t("Give the workout a name of 1–80 characters."));
  if (
    !Array.isArray(w.exercises) ||
    !w.exercises.length ||
    w.exercises.length > 60
  )
    throw new Error(t("Choose 1–60 exercises."));
  if (typeof w.notes !== "string" || w.notes.length > 4000)
    throw new Error(t("Workout notes are invalid."));
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
      throw new Error(t("Invalid exercise content."));
    if (ids.has(e.id)) throw new Error(t("Duplicate exercise ID."));
    ids.add(e.id);
    if (!e.name.trim() || e.name.length > 80)
      throw new Error(t("Every exercise needs a name."));
    if (!["strength", "bodyweight", "run", "time"].includes(e.kind))
      throw new Error(t("Invalid exercise type."));
    if (!Number.isInteger(e.sets) || e.sets < 1 || e.sets > 100)
      throw new Error(t("Sets must be between 1 and 100."));
    for (const n of [e.reps, e.kg, e.seconds, e.meters, e.rest])
      if (!Number.isFinite(n) || n < 0 || n > 100000)
        throw new Error(t("Use valid positive exercise values."));
    if (!Number.isInteger(e.reps))
      throw new Error(t("Reps must be whole numbers."));
    if ((e.kind === "strength" || e.kind === "bodyweight") && e.reps < 1)
      throw new Error(t("Add reps."));
    if (e.kind === "run" && e.seconds <= 0 && e.meters <= 0)
      throw new Error(t("Add time or distance."));
    // Time exercises are timed holds/carries with optional weight. Older ones that
    // only have a distance stay valid.
    if (e.kind === "time" && e.seconds <= 0 && e.meters <= 0)
      throw new Error(t("Add a time."));
  }
  return w;
}
export function dateOnly(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function parseDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(t("Use YYYY-MM-DD."));
  const d = new Date(value + "T12:00:00");
  if (!Number.isFinite(+d) || dateOnly(d) !== value)
    throw new Error(t("Invalid date."));
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
/** Values are English i18n keys; translate with t() when rendering. */
export const EXERCISE_LABELS = {
  strength: "Weight",
  bodyweight: "Bodyweight",
  run: "Run / distance",
  time: "Time",
};
/** 45 -> "45 s", 120 -> "2 min", 150 -> "2 min 30 s". */
export function duration(seconds: number) {
  const m = Math.floor(seconds / 60),
    r = Math.round(seconds % 60);
  return m ? (r ? `${m} min ${r} s` : `${m} min`) : `${r} s`;
}
export function exerciseSummary(e: Exercise) {
  const reps = e.kind === "strength" || e.kind === "bodyweight",
    work = reps
      ? t("{n} reps", { n: e.reps })
      : e.kind === "time" && e.seconds > 0
        ? duration(e.seconds)
        : e.meters
          ? e.meters + " m"
          : duration(e.seconds);
  const weight =
    e.kind === "strength"
      ? " · " + e.kg + " kg"
      : e.kind === "time" && e.kg > 0
        ? " · " + e.kg + " kg"
        : "";
  return `${e.sets} × ${work}${weight}${e.rest ? " · " + t("{n}s rest", { n: e.rest }) : ""}`;
}
