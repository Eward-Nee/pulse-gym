import React, { useEffect, useState, useRef } from "react";
import { View } from "react-native";
import { Button, Card, Row, Sheet, T, Label } from "../components/ui";
import { exerciseSummary, type Workout, type Session } from "../core/model";
import { database, storeSession, uid, serial } from "../services/db";
export type ActiveSession = {
  workout: Workout;
  startedAt: number;
  completedSets: Record<string, number>;
};
export default function SessionScreen({
  initial,
  onClose,
  onFinish,
}: {
  initial: ActiveSession;
  onClose: () => void;
  onFinish: () => void;
}) {
  const [state, set] = useState(initial),
    [now, tick] = useState(Date.now()),
    [restUntil, setRest] = useState(0),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  useEffect(() => {
    const t = setInterval(() => tick(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const elapsed = Math.max(0, Math.floor((now - state.startedAt) / 1000));
  const total = state.workout.exercises.reduce((n, e) => n + e.sets, 0),
    done = Object.values(state.completedSets).reduce((a, b) => a + b, 0);
  const marking = useRef(false);
  async function mark(id: string, delta: number) {
    if (marking.current || saving) return;
    marking.current = true;
    try {
      const e = state.workout.exercises.find((e) => e.id === id)!;
      const next = {
        ...state,
        completedSets: {
          ...state.completedSets,
          [id]: Math.max(
            0,
            Math.min(e.sets, (state.completedSets[id] || 0) + delta),
          ),
        },
      };
      await serial(
        async () =>
          await (
            await database()
          ).runAsync(
            "INSERT OR REPLACE INTO active_session VALUES(1,?)",
            JSON.stringify(next),
          ),
      );
      set(next);
      if (delta > 0) setRest(Date.now() + e.rest * 1000);
    } finally {
      marking.current = false;
    }
  }
  async function finish() {
    if (marking.current || saving) return;
    setSaving(true);
    try {
      const d = await database();
      await serial(() =>
        d.withTransactionAsync(async () => {
          await storeSession({
            id: uid(),
            name: state.workout.name,
            finishedAt: Date.now(),
            seconds: elapsed,
            exercises: state.workout.exercises,
            completedSets: state.completedSets,
          });
          await d.runAsync("DELETE FROM active_session");
        }),
      );
      onFinish();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <Sheet title="Jou sessie" onClose={onClose}>
      <Label>FOKUS / EEN REP OP ’N SLAG</Label>
      <T size={28} bold>
        {state.workout.name}
      </T>
      <Row style={{ marginVertical: 24, justifyContent: "space-between" }}>
        <View>
          <T size={42} bold>
            {String(Math.floor(elapsed / 60)).padStart(2, "0")}:
            {String(elapsed % 60).padStart(2, "0")}
          </T>
          <T muted>verstreke tyd</T>
        </View>
        <View>
          <T size={28} bold>
            {done}/{total}
          </T>
          <T muted>stelle voltooi</T>
        </View>
      </Row>
      {restUntil > now && (
        <Card>
          <T bold>Rus · {Math.ceil((restUntil - now) / 1000)}s</T>
          <T muted>Begin die volgende stel wanneer jy gereed is.</T>
          <Button small label="Slaan rus oor" onPress={() => setRest(0)} />
        </Card>
      )}
      {state.workout.exercises.map((e) => (
        <Card key={e.id}>
          <T bold size={17}>
            {e.name}
          </T>
          <T muted>{exerciseSummary(e)}</T>
          {!!e.notes && (
            <T muted size={12} style={{ marginTop: 8 }}>
              {e.notes}
            </T>
          )}
          <Row style={{ marginTop: 16 }}>
            <Button
              small
              label="−"
              disabled={!state.completedSets[e.id]}
              onPress={() =>
                void mark(e.id, -1).catch((e) => setError(e.message))
              }
            />
            <T bold>
              {state.completedSets[e.id] || 0} / {e.sets}
            </T>
            <Button
              primary
              small
              label="Stel klaar"
              disabled={(state.completedSets[e.id] || 0) >= e.sets}
              onPress={() =>
                void mark(e.id, 1).catch((e) => setError(e.message))
              }
            />
          </Row>
        </Card>
      ))}
      {!!error && <T>{error}</T>}
      <Button
        primary
        label={
          saving
            ? "Stoor…"
            : done === total
              ? "Voltooi & stoor sessie"
              : "Stoor gedeeltelike sessie"
        }
        disabled={saving || done === 0}
        onPress={() => void finish()}
      />
      <T muted size={12} style={{ marginTop: 12 }}>
        Jy kan die skerm sluit en later hervat. Slegs gemerkte stelle tel in jou
        geskiedenis.
      </T>
    </Sheet>
  );
}
