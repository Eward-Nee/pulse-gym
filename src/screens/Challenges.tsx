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
import { t, tn, locale } from "../i18n";
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
        throw new Error(t("Choose a verified friend."));
      const n = Number(target.replace(",", "."));
      if (!title.trim() || !Number.isFinite(n) || n <= 0 || n > 100000)
        throw new Error(t("Add a name and a valid target."));
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
    <Sheet title={t("New challenge")} onClose={onClose}>
      <Label>{t("PICK YOUR PARTNER")}</Label>
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
          title={t("Connect a friend first")}
          body={t("Use Setup to share an invitation code and verify keys.")}
        />
      )}
      <Row style={{ marginVertical: 16 }}>
        {(
          [
            ["run", t("Run")],
            ["exercise", t("Exercise")],
            ["workout", t("Workout")],
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
        label={t("What is the challenge?")}
        value={title}
        maxLength={100}
        placeholder={
          kind === "run"
            ? t("5 km before sunset")
            : kind === "exercise"
              ? t("50 push-ups")
              : t("Finish Partner engine")
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
        label={t("Target ({unit})", {
          unit:
            kind === "run"
              ? "km"
              : kind === "exercise"
                ? t("reps")
                : t("sessions"),
        })}
        keyboardType="decimal-pad"
        value={target}
        onChangeText={setTarget}
      />
      <Label>{t("COMPLETE WITHIN")}</Label>
      <Row>
        {DURATIONS.map((d) => (
          <Chip
            key={d.hours}
            label={t(d.label)}
            selected={hours === d.hours}
            onPress={() => setHours(d.hours)}
          />
        ))}
      </Row>
      <T muted size={12} style={{ marginVertical: 16 }}>
        {t(
          "The deadline starts when you send. If your friend is not reachable, the challenge stays encrypted in your outbox.",
        )}
      </T>
      {!!error && <T style={{ color: "#e97777", marginBottom: 16 }}>{error}</T>}
      <Button
        primary
        label={busy ? t("Saving…") : t("Send challenge")}
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
  const [filter, setFilter] = useState<"all" | "active" | "history">("all");
  const names: Record<string, string> = {
    invited: t("Invitation"),
    accepted: t("Active"),
    completed: t("Completed"),
    declined: t("Declined"),
    expired: t("Expired"),
  };
  const list = data.challenges.filter(
    (c) =>
      filter === "all" ||
      (filter === "active" &&
        ["invited", "accepted"].includes(challengeState(c))) ||
      (filter === "history" &&
        ["completed", "declined", "expired"].includes(challengeState(c))),
  );
  return (
    <FlatList
      data={list}
      keyExtractor={(c) => c.id}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ padding: 22, paddingBottom: 30 }}
      ListHeaderComponent={
        <>
          <Label>{t("YOUR CIRCLE / A LITTLE COMPETITION")}</Label>
          <Heading
            title={
              data.settings.theme === "couples"
                ? t("Together is a\nsuperpower.")
                : t("Who’s in?")
            }
            subtitle={t("Challenge your people. Keep each other moving.")}
          />
          <Row style={{ justifyContent: "space-between", marginBottom: 18 }}>
            <Button
              primary
              label={t("New challenge")}
              icon="add"
              onPress={onNew}
            />
            <Button label={t("Sync")} small icon="sync" onPress={onSync} />
          </Row>
          {data.pendingCount > 0 && (
            <Card>
              <T muted size={12}>
                {tn(
                  data.pendingCount,
                  "{n} message waiting for a direct connection.",
                  "{n} messages waiting for a direct connection.",
                )}
              </T>
            </Card>
          )}
          <Row style={{ marginBottom: 14 }}>
            {(
              [
                ["all", t("All")],
                ["active", t("Active")],
                ["history", t("History")],
              ] as const
            ).map(([f, label]) => (
              <Chip
                key={f}
                label={label}
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
          title={t("A new challenge starts with you.")}
          body={t("Connect a friend in Setup and send your first challenge.")}
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
                {c.direction === "incoming" ? t("FROM") : t("FOR")}{" "}
                {friend?.name.toUpperCase() || t("FRIEND")}
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
                    ? t("reps")
                    : t("sessions")}
              </T>
            </T>
            <T muted size={12} style={{ marginTop: 7 }}>
              {t("Deadline: {date}", {
                date: new Date(c.deadline).toLocaleString(locale()),
              })}
            </T>
            {state !== "expired" &&
              state !== "completed" &&
              state !== "declined" && (
                <T muted size={12}>
                  {t("{h}h {m}m left", {
                    h: Math.floor(remaining / 3600000),
                    m: Math.floor((remaining % 3600000) / 60000),
                  })}
                </T>
              )}
            {c.direction === "outgoing" && (
              <T muted size={11} style={{ marginTop: 8 }}>
                {c.delivered
                  ? t("Delivery confirmed by your friend’s device")
                  : t("Waiting in local outbox")}
              </T>
            )}
            {c.direction === "incoming" && (
              <Row style={{ marginTop: 16 }}>
                {state === "invited" && (
                  <>
                    <Button
                      primary
                      label={t("Accept")}
                      onPress={() => onRespond(c, "accepted")}
                    />
                    <Button
                      label={t("Decline")}
                      onPress={() => onRespond(c, "declined")}
                    />
                  </>
                )}
                {state === "accepted" && (
                  <Button
                    primary
                    label={t("I completed it")}
                    icon="checkmark"
                    onPress={() => onRespond(c, "completed")}
                  />
                )}
              </Row>
            )}
            {state === "completed" && (
              <T muted size={11} style={{ marginTop: 8 }}>
                {t("Self-reported completion.")}
              </T>
            )}
          </Card>
        );
      }}
    />
  );
}
