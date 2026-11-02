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
  ["Sled push", "50 m", "152 kg inkl. sled"],
  ["Sled pull", "50 m", "103 kg inkl. sled"],
  ["Burpee broad jumps", "80 m", "Liggaamsgewig"],
  ["Row", "1 000 m", ""],
  ["Farmers carry", "200 m", "2 × 24 kg"],
  ["Sandbag lunges", "100 m", "20 kg"],
  ["Wall balls", "100 reps", "6 kg · teiken 2.7 m / 3.0 m"],
];
const EASY = [30, 35, 40, 30, 40, 45, 45, 35, 50, 40, 30, 20];
const REPS = [4, 5, 4, 3, 4, 5, 4, 3, 5, 3, 3, 3],
  METERS = [400, 400, 600, 400, 800, 800, 1000, 600, 1000, 1000, 600, 200];
export const PHASES = [
  "Basis",
  "Basis",
  "Basis",
  "Herstel",
  "Bou",
  "Bou",
  "Spesifiek",
  "Herstel",
  "Spesifiek",
  "Repetisie",
  "Taper",
  "Wedrenweek",
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
    throw new Error("Ongeldige week.");
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
    ex("Opwarming · stap/draf + mobiliteit", "time", 1, 0, 0, 600, 0, 0);
  const cool = () => ex("Afkoel · maklik beweeg", "time", 1, 0, 0, 300, 0, 0);
  const strength = make(
    "Ma · Krag & tegniek",
    [
      warm(),
      ex(
        "Squat · kies eie oefengewig",
        "strength",
        sets,
        8,
        0,
        0,
        0,
        120,
        "2–3 reps in reserwe. 0 kg is ’n onbevestigde oefengewig; stel dit voor jy begin.",
      ),
      ex("Dumbbell row", "strength", sets, 10),
      ex(
        "Farmers carry · kies eie gewig",
        "run",
        sets,
        0,
        0,
        0,
        b ? 20 : 30,
        90,
        "Gewig word in notas aangeteken; skaal vir elke maat.",
      ),
      ex(
        "Wall-ball tegniek · kies eie gewig",
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
    "RPE 5–6/10. Tegniek voor gewig; wedrenladings is nie beginnersladings nie.",
  );
  const aerobic = make(
    "Di · Maklike draf",
    [
      warm(),
      ex(
        b ? "Stap/draf · 2 min / 1 min" : "Geselstempo · RPE 3–4",
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
    "Albei maats oefen hul eie basis. Loop teen ’n tempo waar ’n gesprek moontlik bly.",
  );
  const speed = make(
    "Do · Drafintervalle",
    [
      warm(),
      ex(
        b ? "Maklike draf / stap" : "Beheerde draf · RPE 6–7",
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
    "Rus deur stadig te stap/draf. Geen maksimum spoed nie.",
  );
  const accessory = make(
    "Vr · Kragonderhoud",
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
        "Per been. Hou goeie beheer.",
      ),
      cool(),
    ],
    "Hou 2–3 reps in reserwe. Slaan oor as herstel swak is of die wedren binne 72 uur is.",
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
        `Rondte ${r + 1} · hardloop saam`,
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
        n + (b ? " · ligte tegniek" : ""),
        n === "Wall balls" ? "strength" : "run",
        1,
        n === "Wall balls" ? 10 : 0,
        0,
        0,
        meters,
        120,
        "Verdeel stasiewerk; 1 maat werk op ’n slag. Kies eie veilige oefenlading.",
      ),
    );
  }
  engine.push(cool());
  const partner = make(
    "Sa · Partner engine",
    engine,
    "Albei hardloop elke segment saam. Deel slegs die stasiewerk. RPE 6–7; beginners 4–5. Sê “wissel” voor tegniek verval.",
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
        ? " Taper: verminder volume. Beplan hierdie sessies vroeg in die week; geen swaar sessie naby wedrendag."
        : ""),
  }));
}
