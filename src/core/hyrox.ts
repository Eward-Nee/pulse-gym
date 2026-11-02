import { t } from "../i18n";
import {
  daysUntil,
  parseDate,
  dateOnly,
  type Settings,
  type Workout,
  type Exercise,
} from "./model";
export const HYROX_SOURCE =
  "https://maintain.hyrox.com/rulebooks/HYROX_RulebookDoubles_EN.pdf";
export const STATIONS = [
  ["SkiErg", "1 000 m", ""],
  ["Sled push", "50 m", "152 kg incl. sled"],
  ["Sled pull", "50 m", "103 kg incl. sled"],
  ["Burpee broad jumps", "80 m", "Bodyweight"],
  ["Row", "1 000 m", ""],
  ["Farmers carry", "200 m", "2 × 24 kg"],
  ["Sandbag lunges", "100 m", "20 kg"],
  ["Wall balls", "100 reps", "6 kg · target 2.7 m / 3.0 m"],
];
const EASY = [30, 35, 40, 30, 40, 45, 45, 35, 50, 40, 30, 20];
const REPS = [4, 5, 4, 3, 4, 5, 4, 3, 5, 3, 3, 3],
  METERS = [400, 400, 600, 400, 800, 800, 1000, 600, 1000, 1000, 600, 200];
export const PHASES = [
  "Base",
  "Base",
  "Base",
  "Recovery",
  "Build",
  "Build",
  "Specific",
  "Recovery",
  "Specific",
  "Rehearsal",
  "Taper",
  "Race week",
];
export function planPosition(date: string, now = new Date()) {
  const days = daysUntil(date, now);
  return {
    days,
    week: Math.max(1, Math.min(12, 13 - Math.ceil(days / 7))),
    baseWeeks: Math.max(0, Math.ceil(days / 7) - 12),
    past: days < 0,
  };
}
export function weekDates(date: string, week: number) {
  const end = parseDate(date);
  end.setDate(end.getDate() - (12 - week) * 7);
  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  return `${dateOnly(start)} – ${dateOnly(end)}`;
}
export function generateWeek(
  s: Pick<Settings, "level" | "trainingDays">,
  week: number,
  id: () => string,
): Workout[] {
  if (!Number.isInteger(week) || week < 1 || week > 12)
    throw new Error(t("Invalid week."));
  const b = s.level === "foundation",
    taper = week >= 11,
    deload = week === 4 || week === 8,
    sets = taper || deload ? 2 : 3;
  const ex = (
    name: string,
    kind: Exercise["kind"],
    sets: number,
    reps: number,
    kg = 0,
    seconds = 0,
    meters = 0,
    rest = 90,
    notes = "",
  ): Exercise => ({
    id: id(),
    name,
    kind,
    sets,
    reps,
    kg,
    seconds,
    meters,
    rest,
    notes,
  });
  const easy = Math.round(EASY[week - 1] * (b ? 0.65 : 1));
  const make = (
    name: string,
    exercises: Exercise[],
    notes: string,
  ): Workout => ({
    id: id(),
    name: `HYROX W${week} · ${name}`,
    position: 0,
    exercises,
    notes,
  });
  const warm = () =>
    ex(t("Warm-up · walk/jog + mobility"), "time", 1, 0, 0, 600, 0, 0);
  const cool = () =>
    ex(t("Cool-down · easy movement"), "time", 1, 0, 0, 300, 0, 0);
  const strength = make(
    t("Mon · Strength & technique"),
    [
      warm(),
      ex(
        t("Squat · choose your own weight"),
        "strength",
        sets,
        8,
        0,
        0,
        0,
        120,
        t(
          "2–3 reps in reserve. 0 kg is an unconfirmed training weight; set it before you start.",
        ),
      ),
      ex("Dumbbell row", "strength", sets, 10),
      ex(
        t("Farmers carry · choose your own weight"),
        "run",
        sets,
        0,
        0,
        0,
        b ? 20 : 30,
        90,
        t("Record the weight in the notes; scale for each partner."),
      ),
      ex(
        t("Wall-ball technique · choose your own weight"),
        "strength",
        sets,
        10,
        0,
        0,
        0,
        90,
      ),
      cool(),
    ],
    t(
      "RPE 5–6/10. Technique before weight; race loads are not beginner loads.",
    ),
  );
  const aerobic = make(
    t("Tue · Easy run"),
    [
      warm(),
      ex(
        b ? t("Walk/jog · 2 min / 1 min") : t("Conversation pace · RPE 3–4"),
        "time",
        1,
        0,
        0,
        easy * 60,
        0,
        0,
      ),
      cool(),
    ],
    t(
      "Both partners train their own base. Move at a pace where you can still hold a conversation.",
    ),
  );
  const speed = make(
    t("Thu · Run intervals"),
    [
      warm(),
      ex(
        b ? t("Easy jog / walk") : t("Controlled run · RPE 6–7"),
        b ? "time" : "run",
        b ? 4 : REPS[week - 1],
        0,
        0,
        b ? 60 : 0,
        b ? 0 : METERS[week - 1],
        b ? 120 : 90,
      ),
      cool(),
    ],
    t("Rest by walking/jogging slowly. No maximum speed."),
  );
  const accessory = make(
    t("Fri · Strength maintenance"),
    [
      warm(),
      ex("Romanian deadlift", "strength", sets, taper ? 5 : 8),
      ex("Press", "strength", sets, 8),
      ex(
        "Split squat",
        "bodyweight",
        sets,
        8,
        0,
        0,
        0,
        90,
        t("Per leg. Stay in control."),
      ),
      cool(),
    ],
    t(
      "Keep 2–3 reps in reserve. Skip if recovery is poor or the race is within 72 hours.",
    ),
  );
  const stationNames =
    week < 5
      ? ["SkiErg", "Sled push", "Sled pull", "Burpee broad jumps"]
      : week < 9
        ? ["Row", "Farmers carry", "Sandbag lunges", "Wall balls"]
        : [
            "SkiErg",
            "Sled push",
            "Sled pull",
            "Burpee broad jumps",
            "Row",
            "Farmers carry",
          ];
  const rounds = b ? 3 : taper ? 2 : week === 10 ? 6 : 4;
  const engine: Exercise[] = [warm()];
  for (let r = 0; r < rounds; r++) {
    engine.push(
      ex(
        t("Round {n} · run together", { n: r + 1 }),
        "run",
        1,
        0,
        0,
        0,
        b ? 300 : taper ? 400 : week < 5 ? 500 : week < 7 ? 750 : 1000,
        0,
      ),
    );
    const n = stationNames[r % stationNames.length];
    const meters =
      n === "SkiErg" || n === "Row"
        ? 250
        : n === "Sled push" || n === "Sled pull"
          ? 12.5
          : n === "Burpee broad jumps"
            ? 10
            : n === "Farmers carry"
              ? 50
              : n === "Sandbag lunges"
                ? 25
                : 0;
    engine.push(
      ex(
        n + (b ? t(" · light technique") : ""),
        n === "Wall balls" ? "strength" : "run",
        1,
        n === "Wall balls" ? 10 : 0,
        0,
        0,
        meters,
        120,
        t(
          "Split the station work; 1 partner works at a time. Choose your own safe training load.",
        ),
      ),
    );
  }
  engine.push(cool());
  const partner = make(
    t("Sat · Partner engine"),
    engine,
    t(
      "Both run every segment together. Only share the station work. RPE 6–7; beginners 4–5. Say “switch” before technique breaks down.",
    ),
  );
  return (
    s.trainingDays === 3
      ? [strength, aerobic, partner]
      : s.trainingDays === 4
        ? [strength, aerobic, speed, partner]
        : [strength, aerobic, speed, accessory, partner]
  ).map((w, position) => ({
    ...w,
    position,
    notes:
      w.notes +
      (taper
        ? t(
            " Taper: reduce volume. Plan these sessions early in the week; no heavy session close to race day.",
          )
        : ""),
  }));
}
