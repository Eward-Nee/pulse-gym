import React, { useState } from "react";
import { Linking, View } from "react-native";
import {
  Button,
  Card,
  Chip,
  Field,
  Heading,
  Label,
  Row,
  Sheet,
  T,
  Pill,
} from "../components/ui";
import {
  generateWeek,
  HYROX_SOURCE,
  PHASES,
  planPosition,
  STATIONS,
  weekDates,
} from "../core/hyrox";
import {
  type Settings,
  type Workout,
  exerciseSummary,
  daysUntil,
} from "../core/model";
import { uid } from "../services/db";
import { t } from "../i18n";
export default function HyroxScreen({
  settings,
  onSettings,
  onImport,
  onClose,
}: {
  settings: Settings;
  onSettings: (s: Partial<Settings>) => Promise<void>;
  onImport: (w: Workout[]) => Promise<void>;
  onClose: () => void;
}) {
  const [s, set] = useState(settings),
    [week, setWeek] = useState(() =>
      settings.raceDate ? planPosition(settings.raceDate).week : 1,
    ),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false),
    [showRules, rules] = useState(false),
    [busy, setBusy] = useState(false);
  let position: ReturnType<typeof planPosition> | null = null;
  try {
    if (s.raceDate) position = planPosition(s.raceDate);
  } catch {}
  const sessions = generateWeek(s, week, uid);
  const save = async () => {
    try {
      if (daysUntil(s.raceDate) < 0)
        throw new Error(t("Choose a future race date."));
      await onSettings({
        raceDate: s.raceDate,
        level: s.level,
        trainingDays: s.trainingDays,
      });
      setSaved(true);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <Sheet title={t("HYROX · Mixed Doubles")} onClose={onClose}>
      <Label>{t("ONE TEAM. RACE READY.")}</Label>
      <Heading
        title={t("Your road to\nthe start line.")}
        subtitle={t("12 weeks · base, build, specific and taper")}
      />
      <Card>
        <Field
          label={t("Race date (YYYY-MM-DD)")}
          value={s.raceDate}
          placeholder="2027-03-20"
          onChangeText={(raceDate) => {
            set({ ...s, raceDate });
            setSaved(false);
          }}
        />
        <T muted size={12}>
          {t("Use your booked date; there is no preset event.")}
        </T>
        <Row style={{ marginTop: 16 }}>
          <Chip
            label={t("Build a base first")}
            selected={s.level === "foundation"}
            onPress={() => set({ ...s, level: "foundation" })}
          />
          <Chip
            label={t("Train regularly")}
            selected={s.level === "regular"}
            onPress={() => set({ ...s, level: "regular" })}
          />
        </Row>
        <T muted size={12} style={{ marginVertical: 8 }}>
          {t(
            "Regular: already 30 min of easy running and strength training experience.",
          )}
        </T>
        <Row>
          {([3, 4, 5] as const).map((trainingDays) => (
            <Chip
              key={trainingDays}
              label={t("{n} days / week", { n: trainingDays })}
              selected={s.trainingDays === trainingDays}
              onPress={() => set({ ...s, trainingDays })}
            />
          ))}
        </Row>
        <Button
          primary
          label={
            saved ? t("Date and preferences saved ✓") : t("Save race settings")
          }
          onPress={() => void save()}
        />
      </Card>
      {position && (
        <Card>
          <Row style={{ justifyContent: "space-between" }}>
            <T size={38} bold>
              {Math.max(0, position.days)}
            </T>
            <T muted>{t("days until your race")}</T>
          </Row>
          <T muted>
            {position.days <= 0
              ? t("Race day or recovery: do not catch up on extra volume now.")
              : position.baseWeeks > 0
                ? t("{n} weeks of pre-base before the 12-week block.", {
                    n: position.baseWeeks,
                  })
                : position.days < 77
                  ? t(
                      "Shorter lead-up: pick a suitable phase with a coach; do not catch up on missed volume.",
                    )
                  : t("Plenty of room for the full 12-week block.")}
          </T>
        </Card>
      )}
      <Row>
        {PHASES.map((p, i) => (
          <Chip
            key={i}
            label={`W${i + 1}`}
            selected={week === i + 1}
            onPress={() => setWeek(i + 1)}
          />
        ))}
      </Row>
      <View style={{ marginVertical: 14 }}>
        <Label>
          {t("WEEK {w} / {phase}", {
            w: week,
            phase: t(PHASES[week - 1]).toUpperCase(),
          })}
        </Label>
        {position && <T muted>{weekDates(s.raceDate, week)}</T>}
      </View>
      {sessions.map((w, i) => (
        <Card key={i}>
          <T bold size={17}>
            {w.name.replace(/^HYROX W\d+ · /, "")}
          </T>
          <T muted size={12} style={{ marginVertical: 8 }}>
            {w.notes}
          </T>
          {w.exercises.map((e, j) => (
            <View key={j} style={{ marginVertical: 6 }}>
              <T size={13}>{e.name}</T>
              <T muted size={11}>
                {exerciseSummary(e)}
              </T>
            </View>
          ))}
        </Card>
      ))}
      {!!error && <T style={{ color: "#e97777", marginBottom: 12 }}>{error}</T>}
      <Button
        primary
        label={
          busy
            ? t("Adding…")
            : t("Add week {w}’s {n} workouts", {
                w: week,
                n: sessions.length,
              })
        }
        disabled={busy || !position || position.days <= 0}
        onPress={() => {
          setBusy(true);
          void onImport(sessions)
            .then(() =>
              setError(t("Week added to Home. You can edit each workout.")),
            )
            .catch((e) => setError(e.message))
            .finally(() => setBusy(false));
        }}
      />
      <Card style={{ marginTop: 18 }}>
        <Label>{t("PARTNER STRATEGY")}</Label>
        <T>
          {t(
            "Run every segment together. Split the station work by ability, not by gender.",
          )}
        </T>
        <T muted size={12} style={{ marginTop: 10 }}>
          {t(
            "Practice 250 m SkiErg turns, 500 m row turns, 12.5 m sled lengths and 10-rep wall-ball sets as a starting point. Test the switches; adjust before technique breaks down.",
          )}
        </T>
      </Card>
      <Button
        label={
          showRules
            ? t("Hide race standards")
            : t("8 stations · official 26/27 standards")
        }
        onPress={() => rules(!showRules)}
      />
      {showRules && (
        <Card style={{ marginTop: 12 }}>
          {STATIONS.map(([name, distance, load], i) => (
            <View key={name} style={{ marginBottom: 16 }}>
              <T bold>
                {i + 1}. {name} · {distance}
              </T>
              <T muted size={12}>
                {load ? t(load) : t("No external weight")} ·{" "}
                {t("preceded by: 1 km together")}
              </T>
            </View>
          ))}
          <Button
            label={t("Read official rules ↗")}
            onPress={() => void Linking.openURL(HYROX_SOURCE)}
          />
        </Card>
      )}
      <T muted size={12} style={{ marginTop: 18 }}>
        {t(
          "Original sample program, not an official HYROX program or personal coaching. Training loads start unconfirmed: set them to each partner’s ability. Keep 2–3 reps in reserve; recover on the other days. Reduce volume when fatigue persists. Pain or injury needs appropriate professional guidance. Re-check the rules for your race season.",
        )}
      </T>
      <Button
        label={t("Preparation source ↗")}
        small
        onPress={() =>
          void Linking.openURL("https://hyrox.com/best-hyrox-preparation/")
        }
      />
    </Sheet>
  );
}
