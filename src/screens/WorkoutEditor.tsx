import React, { useState } from "react";
import { View } from "react-native";
import {
  Button,
  Card,
  Field,
  Row,
  Chip,
  T,
  Label,
  Sheet,
} from "../components/ui";
import {
  type Workout,
  type Exercise,
  EXERCISE_LABELS,
  move,
  validateWorkout,
} from "../core/model";
import { uid } from "../services/db";
import { t } from "../i18n";
export function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  const [text, set] = useState(String(value));
  return (
    <Field
      label={label}
      value={text}
      keyboardType="decimal-pad"
      onChangeText={(v) => {
        set(v);
        const n = Number(v.replace(",", "."));
        onChange(Number.isFinite(n) ? n : -1);
      }}
    />
  );
}
/** Two equal columns per row. No wrapping or percentage widths, so fields can never overlap. */
function Grid({ children }: { children: React.ReactNode }) {
  const cells = React.Children.toArray(children),
    rows: React.ReactNode[][] = [];
  for (let i = 0; i < cells.length; i += 2) rows.push(cells.slice(i, i + 2));
  return (
    <View style={{ marginTop: 10 }}>
      {rows.map((row, i) => (
        <View key={i} style={{ flexDirection: "row", gap: 10 }}>
          {[0, 1].map((j) => (
            <View key={j} style={{ flex: 1, minWidth: 0 }}>
              {row[j]}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}
export default function WorkoutEditor({
  workout,
  onSave,
  onClose,
}: {
  workout: Workout;
  onSave: (w: Workout) => Promise<void>;
  onClose: () => void;
}) {
  const [w, set] = useState<Workout>(JSON.parse(JSON.stringify(workout)));
  const [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  const edit = (index: number, patch: Partial<Exercise>) =>
    set({
      ...w,
      exercises: w.exercises.map((e, i) =>
        i === index ? { ...e, ...patch } : e,
      ),
    });
  return (
    <Sheet title={t("Workout builder")} onClose={onClose}>
      <Field
        label={t("Workout name")}
        value={w.name}
        maxLength={80}
        onChangeText={(name) => set({ ...w, name })}
      />
      <Field
        label={t("Notes / training goal")}
        value={w.notes}
        multiline
        onChangeText={(notes) => set({ ...w, notes })}
      />
      {w.exercises.map((e, i) => (
        <Card key={e.id}>
          <Row style={{ justifyContent: "space-between", marginBottom: 12 }}>
            <Label>
              {t("EXERCISE {n}", { n: String(i + 1).padStart(2, "0") })}
            </Label>
            <Row>
              <Button
                small
                label="↑"
                disabled={i === 0}
                onPress={() =>
                  set({ ...w, exercises: move(w.exercises, i, i - 1) })
                }
              />
              <Button
                small
                label="↓"
                disabled={i === w.exercises.length - 1}
                onPress={() =>
                  set({ ...w, exercises: move(w.exercises, i, i + 1) })
                }
              />
              <Button
                small
                label={t("Remove")}
                danger
                onPress={() =>
                  set({
                    ...w,
                    exercises: w.exercises.filter((x) => x.id !== e.id),
                  })
                }
              />
            </Row>
          </Row>
          <Field
            label={t("Exercise")}
            value={e.name}
            maxLength={80}
            onChangeText={(name) => edit(i, { name })}
          />
          <Row>
            {Object.entries(EXERCISE_LABELS).map(([kind, label]) => (
              <Chip
                key={kind}
                label={t(label)}
                selected={e.kind === kind}
                onPress={() =>
                  edit(i, {
                    kind: kind as Exercise["kind"],
                    kg: kind === "strength" ? e.kg : 0,
                  })
                }
              />
            ))}
          </Row>
          <Grid>
            <NumberField
              label={t("Sets")}
              value={e.sets}
              onChange={(sets) => edit(i, { sets })}
            />
            {["strength", "bodyweight"].includes(e.kind) && (
              <NumberField
                label={t("Reps per set")}
                value={e.reps}
                onChange={(reps) => edit(i, { reps })}
              />
            )}
            {e.kind === "strength" && (
              <NumberField
                label={t("Weight (kg)")}
                value={e.kg}
                onChange={(kg) => edit(i, { kg })}
              />
            )}
            {["run", "time"].includes(e.kind) && (
              <NumberField
                label={t("Time (seconds)")}
                value={e.seconds}
                onChange={(seconds) => edit(i, { seconds })}
              />
            )}
            {["run", "time"].includes(e.kind) && (
              <NumberField
                label={t("Distance (meters)")}
                value={e.meters}
                onChange={(meters) => edit(i, { meters })}
              />
            )}
            <NumberField
              label={t("Rest (seconds)")}
              value={e.rest}
              onChange={(rest) => edit(i, { rest })}
            />
          </Grid>
          <Field
            label={t("Exercise notes")}
            value={e.notes}
            onChangeText={(notes) => edit(i, { notes })}
          />
        </Card>
      ))}
      <Button
        label={t("Add exercise")}
        icon="add"
        disabled={w.exercises.length >= 60}
        onPress={() =>
          set({
            ...w,
            exercises: [
              ...w.exercises,
              {
                id: uid(),
                name: "",
                kind: "strength",
                sets: 3,
                reps: 10,
                kg: 0,
                seconds: 0,
                meters: 0,
                rest: 90,
                notes: "",
              },
            ],
          })
        }
      />
      {!!error && (
        <T style={{ color: "#e97777", marginVertical: 12 }}>{error}</T>
      )}
      <View style={{ marginTop: 16 }}>
        <Button
          primary
          label={saving ? t("Saving…") : t("Save workout")}
          disabled={saving}
          icon="checkmark"
          onPress={() => {
            try {
              validateWorkout(w);
              setSaving(true);
              void onSave(w)
                .catch((e) => setError(e.message))
                .finally(() => setSaving(false));
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        />
      </View>
    </Sheet>
  );
}
