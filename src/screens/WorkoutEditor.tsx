import React, { useState } from "react";
import { View, Alert, Platform } from "react-native";
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
export function NumberField({
  label,
  value,
  onChange,
  min = 0,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
}) {
  const [text, set] = useState(String(value));
  return (
    <View style={{ width: "47%" }}>
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
    <Sheet title="Workout bouer" onClose={onClose}>
      <Field
        label="Workout-naam"
        value={w.name}
        maxLength={80}
        onChangeText={(name) => set({ ...w, name })}
      />
      <Field
        label="Notas / oefendoel"
        value={w.notes}
        multiline
        onChangeText={(notes) => set({ ...w, notes })}
      />
      {w.exercises.map((e, i) => (
        <Card key={e.id}>
          <Row style={{ justifyContent: "space-between", marginBottom: 12 }}>
            <Label>OEFENING {String(i + 1).padStart(2, "0")}</Label>
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
                label="Verwyder"
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
            label="Oefening"
            value={e.name}
            maxLength={80}
            onChangeText={(name) => edit(i, { name })}
          />
          <Row>
            {Object.entries(EXERCISE_LABELS).map(([kind, label]) => (
              <Chip
                key={kind}
                label={label}
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
          <Row style={{ marginTop: 10 }}>
            <NumberField
              label="Stelle"
              value={e.sets}
              onChange={(sets) => edit(i, { sets })}
            />
            {["strength", "bodyweight"].includes(e.kind) && (
              <NumberField
                label="Reps per stel"
                value={e.reps}
                onChange={(reps) => edit(i, { reps })}
              />
            )}
            {e.kind === "strength" && (
              <NumberField
                label="Gewig (kg)"
                value={e.kg}
                onChange={(kg) => edit(i, { kg })}
              />
            )}
            {["run", "time"].includes(e.kind) && (
              <>
                <NumberField
                  label="Tyd (sekondes)"
                  value={e.seconds}
                  onChange={(seconds) => edit(i, { seconds })}
                />
                <NumberField
                  label="Afstand (meter)"
                  value={e.meters}
                  onChange={(meters) => edit(i, { meters })}
                />
              </>
            )}
            <NumberField
              label="Rus (sekondes)"
              value={e.rest}
              onChange={(rest) => edit(i, { rest })}
            />
          </Row>
          <Field
            label="Oefening-notas"
            value={e.notes}
            onChangeText={(notes) => edit(i, { notes })}
          />
        </Card>
      ))}
      <Button
        label="Voeg oefening by"
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
          label={saving ? "Stoor…" : "Stoor workout"}
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
