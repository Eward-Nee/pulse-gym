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
export default function HyroxScreen({
  settings,
  onSettings,
  onImport,
  onClose,
}: {
  settings: Settings;
  onSettings: (s: Settings) => Promise<void>;
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
        throw new Error("Kies ’n toekomstige wedrendatum.");
      await onSettings(s);
      setSaved(true);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <Sheet title="HYROX · Mixed Doubles" onClose={onClose}>
      <Label>ONE TEAM. RACE READY.</Label>
      <Heading
        title={"Julle pad na\ndie wegspring."}
        subtitle="12 weke · basis, bou, spesifiek en taper"
      />
      <Card>
        <Field
          label="Wedrendatum (JJJJ-MM-DD)"
          value={s.raceDate}
          placeholder="2027-03-20"
          onChangeText={(raceDate) => {
            set({ ...s, raceDate });
            setSaved(false);
          }}
        />
        <T muted size={12}>
          Gebruik julle geboekte datum; daar is geen voorafgekose gebeurtenis
          nie.
        </T>
        <Row style={{ marginTop: 16 }}>
          <Chip
            label="Bou eers ’n basis"
            selected={s.level === "foundation"}
            onPress={() => set({ ...s, level: "foundation" })}
          />
          <Chip
            label="Oefen gereeld"
            selected={s.level === "regular"}
            onPress={() => set({ ...s, level: "regular" })}
          />
        </Row>
        <T muted size={12} style={{ marginVertical: 8 }}>
          Gereeld: reeds 30 min gemaklike draf en kragoefenervaring.
        </T>
        <Row>
          {([3, 4, 5] as const).map((trainingDays) => (
            <Chip
              key={trainingDays}
              label={`${trainingDays} dae / week`}
              selected={s.trainingDays === trainingDays}
              onPress={() => set({ ...s, trainingDays })}
            />
          ))}
        </Row>
        <Button
          primary
          label={
            saved ? "Datum en voorkeure gestoor ✓" : "Stoor wedreninstellings"
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
            <T muted>dae tot julle wedren</T>
          </Row>
          <T muted>
            {position.days <= 0
              ? "Wedrendag of herstel: moenie nou ekstra volume inhaal nie."
              : position.baseWeeks > 0
                ? `${position.baseWeeks} weke voorbasis voor die 12-week blok.`
                : position.days < 77
                  ? "Korter aanloop: kies ’n gepaste fase met ’n afrigter; moenie gemiste volume inhaal nie."
                  : "Genoeg ruimte vir die volledige 12-week blok."}
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
          WEEK {week} / {PHASES[week - 1].toUpperCase()}
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
            ? "Voeg by…"
            : `Voeg week ${week} se ${sessions.length} workouts by`
        }
        disabled={busy || !position || position.days <= 0}
        onPress={() => {
          setBusy(true);
          void onImport(sessions)
            .then(() =>
              setError("Week by Home gevoeg. Jy kan elke workout wysig."),
            )
            .catch((e) => setError(e.message))
            .finally(() => setBusy(false));
        }}
      />
      <Card style={{ marginTop: 18 }}>
        <Label>MAATSTRATEGIE</Label>
        <T>
          Hardloop elke segment saam. Deel die stasiewerk volgens vermoë, nie
          volgens geslag nie.
        </T>
        <T muted size={12} style={{ marginTop: 10 }}>
          Oefen 250 m SkiErg-beurte, 500 m row-beurte, 12.5 m sled-lengtes en
          10-rep wall-ball stelle as beginpunt. Toets wissels; pas aan voordat
          tegniek verval.
        </T>
      </Card>
      <Button
        label={
          showRules
            ? "Verberg wedrenstandaarde"
            : "8 stasies · amptelike 26/27-standaarde"
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
                {load || "Geen eksterne gewig"} · vooraf: 1 km saam
              </T>
            </View>
          ))}
          <Button
            label="Lees amptelike reëls ↗"
            onPress={() => void Linking.openURL(HYROX_SOURCE)}
          />
        </Card>
      )}
      <T muted size={12} style={{ marginTop: 18 }}>
        Oorspronklike voorbeeldprogram, nie ’n amptelike HYROX-program of
        persoonlike afrigting nie. Oefenladings begin onbevestig: stel dit
        volgens elke maat se vermoë. Hou 2–3 reps in reserwe; herstel op die
        ander dae. Verminder volume by aanhoudende moegheid. Pyn of beserings
        benodig toepaslike professionele leiding. Herkontroleer reëls vir julle
        wedrenseisoen.
      </T>
      <Button
        label="Voorbereidingsbron ↗"
        small
        onPress={() =>
          void Linking.openURL("https://hyrox.com/best-hyrox-preparation/")
        }
      />
    </Sheet>
  );
}
