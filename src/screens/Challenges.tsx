import React, { useEffect, useState } from "react";
import { FlatList, View } from "react-native";
import {
  Button,
  Card,
  Chip,
  Empty,
  Field,
  Heading,
  Label,
  Pill,
  Row,
  Sheet,
  T,
} from "../components/ui";
import {
  type Snapshot,
  type Challenge,
  DURATIONS,
  challengeState,
} from "../core/model";
import { uid } from "../services/db";
export function ChallengeBuilder({
  data,
  onSend,
  onClose,
}: {
  data: Snapshot;
  onSend: (c: Challenge) => Promise<void>;
  onClose: () => void;
}) {
  const friends = data.friends.filter(
      (f) => f.status === "accepted" && f.verified,
    ),
    [friendId, setFriend] = useState(data.partnerId || friends[0]?.id || ""),
    [title, setTitle] = useState(""),
    [kind, setKind] = useState<Challenge["kind"]>("run"),
    [target, setTarget] = useState("5"),
    [hours, setHours] = useState(24),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function send() {
    try {
      if (!friends.some((f) => f.id === friendId))
        throw new Error("Kies ’n geverifieerde vriend.");
      const n = Number(target.replace(",", "."));
      if (!title.trim() || !Number.isFinite(n) || n <= 0 || n > 100000)
        throw new Error("Voeg ’n naam en geldige teiken by.");
      setBusy(true);
      const now = Date.now();
      await onSend({
        id: uid(),
        friendId,
        title: title.trim(),
        kind,
        target: n,
        deadline: now + hours * 3600000,
        createdAt: now,
        direction: "outgoing",
        status: "invited",
        delivered: 0,
      });
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet title="Nuwe challenge" onClose={onClose}>
      <Label>KIES JOU MAAT</Label>
      <Row>
        {friends.map((f) => (
          <Chip
            key={f.id}
            label={f.name}
            selected={friendId === f.id}
            onPress={() => setFriend(f.id)}
          />
        ))}
      </Row>
      {!friends.length && (
        <Empty
          icon="people-outline"
          title="Koppel eers ’n vriend"
          body="Gebruik Setup om ’n uitnodigingskode te deel en sleutels te verifieer."
        />
      )}
      <Row style={{ marginVertical: 16 }}>
        {(
          [
            ["run", "Draf"],
            ["exercise", "Oefening"],
            ["workout", "Workout"],
          ] as const
        ).map(([k, l]) => (
          <Chip
            key={k}
            label={l}
            selected={kind === k}
            onPress={() => setKind(k)}
          />
        ))}
      </Row>
      <Field
        label="Wat is die uitdaging?"
        value={title}
        maxLength={100}
        placeholder={
          kind === "run"
            ? "5 km voor sononder"
            : kind === "exercise"
              ? "50 push-ups"
              : "Voltooi Partner engine"
        }
        onChangeText={setTitle}
      />
      {kind === "workout" && (
        <Row>
          {data.workouts.slice(0, 8).map((w) => (
            <Chip
              key={w.id}
              label={w.name}
              selected={title === w.name}
              onPress={() => {
                setTitle(w.name);
                setTarget("1");
              }}
            />
          ))}
        </Row>
      )}
      <Field
        label={`Teiken (${kind === "run" ? "km" : kind === "exercise" ? "reps" : "sessies"})`}
        keyboardType="decimal-pad"
        value={target}
        onChangeText={setTarget}
      />
      <Label>VOLTOOI BINNE</Label>
      <Row>
        {DURATIONS.map((d) => (
          <Chip
            key={d.hours}
            label={d.label}
            selected={hours === d.hours}
            onPress={() => setHours(d.hours)}
          />
        ))}
      </Row>
      <T muted size={12} style={{ marginVertical: 16 }}>
        Die sperdatum begin wanneer jy stuur. As jou vriend nie bereikbaar is
        nie, bly die uitdaging geënkripteer in jou uitboks.
      </T>
      {!!error && <T style={{ color: "#e97777", marginBottom: 16 }}>{error}</T>}
      <Button
        primary
        label={busy ? "Stoor…" : "Stuur challenge"}
        disabled={busy || !friends.length}
        icon="paper-plane-outline"
        onPress={() => void send()}
      />
    </Sheet>
  );
}
export default function Challenges({
  data,
  onNew,
  onRespond,
  onSync,
}: {
  data: Snapshot;
  onNew: () => void;
  onRespond: (c: Challenge, s: "accepted" | "declined" | "completed") => void;
  onSync: () => void;
}) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);
  const [filter, setFilter] = useState("Alles");
  const names: Record<string, string> = {
    invited: "Uitnodiging",
    accepted: "Aktief",
    completed: "Voltooi",
    declined: "Geweier",
    expired: "Verstryk",
  };
  const list = data.challenges.filter(
    (c) =>
      filter === "Alles" ||
      (filter === "Aktief" &&
        ["invited", "accepted"].includes(challengeState(c))) ||
      (filter === "Geskiedenis" &&
        ["completed", "declined", "expired"].includes(challengeState(c))),
  );
  return (
    <FlatList
      data={list}
      keyExtractor={(c) => c.id}
      contentContainerStyle={{ padding: 22, paddingBottom: 30 }}
      ListHeaderComponent={
        <>
          <Label>JOU KRING / ’N BIETJIE KOMPETISIE</Label>
          <Heading
            title={
              data.settings.theme === "couples"
                ? "Saam is ’n\nsuperkrag."
                : "Wie’s in?"
            }
            subtitle="Daag jou mense uit. Hou mekaar aan die beweeg."
          />
          <Row style={{ justifyContent: "space-between", marginBottom: 18 }}>
            <Button primary label="Nuwe challenge" icon="add" onPress={onNew} />
            <Button label="Sinkroniseer" small icon="sync" onPress={onSync} />
          </Row>
          {data.pendingCount > 0 && (
            <Card>
              <T muted size={12}>
                {data.pendingCount} boodskap(pe) wag vir ’n direkte verbinding.
              </T>
            </Card>
          )}
          <Row style={{ marginBottom: 14 }}>
            {["Alles", "Aktief", "Geskiedenis"].map((f) => (
              <Chip
                key={f}
                label={f}
                selected={filter === f}
                onPress={() => setFilter(f)}
              />
            ))}
          </Row>
        </>
      }
      ListEmptyComponent={
        <Empty
          icon="flash-outline"
          title="’n Nuwe uitdaging begin by jou."
          body="Koppel ’n vriend in Setup en stuur julle eerste challenge."
        />
      }
      renderItem={({ item: c }) => {
        const state = challengeState(c),
          remaining = Math.max(0, c.deadline - Date.now()),
          friend = data.friends.find((f) => f.id === c.friendId);
        return (
          <Card>
            <Row style={{ justifyContent: "space-between" }}>
              <Label>
                {c.direction === "incoming" ? "VAN" : "VIR"}{" "}
                {friend?.name.toUpperCase() || "VRIEND"}
              </Label>
              <Pill>{names[state]}</Pill>
            </Row>
            <T size={23} bold style={{ marginVertical: 12 }}>
              {c.title}
            </T>
            <T size={35} bold>
              {c.target}{" "}
              <T muted>
                {c.kind === "run"
                  ? "km"
                  : c.kind === "exercise"
                    ? "reps"
                    : "sessies"}
              </T>
            </T>
            <T muted size={12} style={{ marginTop: 7 }}>
              Sperdatum: {new Date(c.deadline).toLocaleString("af-ZA")}
            </T>
            {state !== "expired" &&
              state !== "completed" &&
              state !== "declined" && (
                <T muted size={12}>
                  {Math.floor(remaining / 3600000)}u{" "}
                  {Math.floor((remaining % 3600000) / 60000)}m oor
                </T>
              )}
            {c.direction === "outgoing" && (
              <T muted size={11} style={{ marginTop: 8 }}>
                {c.delivered
                  ? "Aflewering bevestig deur vriend se toestel"
                  : "Wag in plaaslike uitboks"}
              </T>
            )}
            {c.direction === "incoming" && (
              <Row style={{ marginTop: 16 }}>
                {state === "invited" && (
                  <>
                    <Button
                      primary
                      label="Aanvaar"
                      onPress={() => onRespond(c, "accepted")}
                    />
                    <Button
                      label="Weier"
                      onPress={() => onRespond(c, "declined")}
                    />
                  </>
                )}
                {state === "accepted" && (
                  <Button
                    primary
                    label="Ek het dit voltooi"
                    icon="checkmark"
                    onPress={() => onRespond(c, "completed")}
                  />
                )}
              </Row>
            )}
            {state === "completed" && (
              <T muted size={11} style={{ marginTop: 8 }}>
                Self-gerapporteerde voltooiing.
              </T>
            )}
          </Card>
        );
      }}
    />
  );
}
