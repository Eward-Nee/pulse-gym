import React, { useState } from "react";
import { FlatList, Pressable, View, Text } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  Button,
  Card,
  Empty,
  Hero,
  Heading,
  Label,
  Pill,
  Row,
  T,
  useTheme,
} from "../components/ui";
import { t, tn } from "../i18n";
import {
  type Snapshot,
  type Workout,
  challengeState,
  exerciseSummary,
  daysUntil,
} from "../core/model";
export default function Home({
  data,
  onEdit,
  onStart,
  onNew,
  onDelete,
  onMove,
  onHyrox,
  onChallenges,
  onHistory,
  hasActive,
  onResume,
  onCancelActive,
}: {
  data: Snapshot;
  onEdit: (w: Workout) => void;
  onStart: (w: Workout) => void;
  onNew: () => void;
  onDelete: (w: Workout) => void;
  onMove: (w: Workout, d: number) => void;
  onHyrox: () => void;
  onChallenges: () => void;
  onHistory: () => void;
  hasActive: boolean;
  onResume: () => void;
  onCancelActive: () => void;
}) {
  const { c } = useTheme();
  const partner = data.friends.find((f) => f.id === data.partnerId);
  const invites = data.challenges.filter(
    (c) => c.direction === "incoming" && challengeState(c) === "invited",
  );
  const weekSessions = data.sessions.filter(
    (s) => s.finishedAt > Date.now() - 7 * 86400000,
  );
  return (
    <FlatList
      data={data.workouts}
      keyExtractor={(w) => w.id}
      contentContainerStyle={{ padding: 22, paddingBottom: 30 }}
      initialNumToRender={8}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <>
          <Row style={{ justifyContent: "space-between", marginBottom: 20 }}>
            <View>
              <Label>{t("YOUR CIRCLE / YOUR MOMENTUM")}</Label>
              <T size={25} bold>
                {t("Hey, {name}.", { name: data.settings.name.split(" ")[0] })}
              </T>
            </View>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: c.soft,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <T bold style={{ color: c.accent }}>
                {data.settings.name.slice(0, 2).toUpperCase()}
              </T>
            </View>
          </Row>
          {data.settings.theme === "couples" && (
            <Card>
              <Row>
                <Ionicons name="heart" color={c.accent} size={22} />
                <View style={{ flex: 1 }}>
                  <T bold>
                    {partner
                      ? `${data.settings.name} + ${partner.name}`
                      : t("Your Couples space")}
                  </T>
                  <T muted size={12}>
                    {partner
                      ? t("One team. Your own pace.")
                      : t("Pick one partner from the Setup friend list.")}
                  </T>
                </View>
              </Row>
            </Card>
          )}
          <Hero
            couples={data.settings.theme === "couples"}
            wallpaper={data.settings.wallpaper}
            onPress={() =>
              data.workouts.length ? onStart(data.workouts[0]) : onNew()
            }
          />
          {hasActive && (
            <Card>
              <Label>{t("YOUR SESSION IS WAITING")}</Label>
              <Row>
                <Button
                  label={t("Resume active workout")}
                  primary
                  icon="play"
                  onPress={onResume}
                />
                <Button
                  label={t("Cancel workout")}
                  danger
                  icon="close-circle-outline"
                  onPress={onCancelActive}
                />
              </Row>
            </Card>
          )}
          <Row style={{ justifyContent: "space-between", marginBottom: 22 }}>
            <View>
              <T size={25} bold>
                {weekSessions.length}
              </T>
              <T muted size={11}>
                {t("sessions / 7 days")}
              </T>
            </View>
            <View>
              <T size={25} bold>
                {Math.round(
                  weekSessions.reduce((n, s) => n + s.seconds, 0) / 60,
                )}
              </T>
              <T muted size={11}>
                {t("minutes trained")}
              </T>
            </View>
            <View>
              <T size={25} bold>
                {data.friends.filter((f) => f.status === "accepted").length}
              </T>
              <T muted size={11}>
                {t("friends")}
              </T>
            </View>
            <Button label={t("History")} small onPress={onHistory} />
          </Row>
          {invites.length > 0 && (
            <Card>
              <Row style={{ justifyContent: "space-between" }}>
                <View style={{ flex: 1 }}>
                  <Label>{t("NEW CHALLENGE")}</Label>
                  <T bold>{invites[0].title}</T>
                  <T muted size={12}>
                    {
                      data.friends.find((f) => f.id === invites[0].friendId)
                        ?.name
                    }
                  </T>
                </View>
                <Button label={t("View")} small onPress={onChallenges} />
              </Row>
            </Card>
          )}
          <Pressable accessibilityRole="button" onPress={onHyrox}>
            <Card>
              <Row style={{ justifyContent: "space-between" }}>
                <View style={{ flex: 1 }}>
                  <Label>{t("HYROX / MIXED DOUBLES")}</Label>
                  <T size={18} bold>
                    {data.settings.raceDate
                      ? t("One team. Race ready.")
                      : t("Pick your race date.")}
                  </T>
                  <T muted size={12} style={{ marginTop: 5 }}>
                    {data.settings.raceDate
                      ? t("{n} days left · {d} training days / week", {
                          n: Math.max(0, daysUntil(data.settings.raceDate)),
                          d: data.settings.trainingDays,
                        })
                      : t("A plan that works back from the start line.")}
                  </T>
                </View>
                <Ionicons name="arrow-forward" color={c.accent} size={23} />
              </Row>
            </Card>
          </Pressable>
          <Row
            style={{
              justifyContent: "space-between",
              marginTop: 12,
              marginBottom: 14,
            }}
          >
            <T size={20} bold>
              {t("Your workouts")}
            </T>
            <Button label={t("New")} small primary icon="add" onPress={onNew} />
          </Row>
        </>
      }
      renderItem={({ item: w, index }) => (
        <Card>
          <Row style={{ alignItems: "flex-start" }}>
            <T size={22} bold style={{ color: c.accent, width: 30 }}>
              {String(index + 1).padStart(2, "0")}
            </T>
            <View style={{ flex: 1 }}>
              <T size={17} bold>
                {w.name}
              </T>
              <T muted size={12} style={{ marginTop: 4 }}>
                {tn(w.exercises.length, "{n} exercise", "{n} exercises")} ·{" "}
                {tn(
                  w.exercises.reduce((s, e) => s + e.sets, 0),
                  "{n} set",
                  "{n} sets",
                )}
              </T>
              {w.exercises.slice(0, 2).map((e) => (
                <T muted key={e.id} size={11} style={{ marginTop: 4 }}>
                  {e.name} / {exerciseSummary(e)}
                </T>
              ))}
            </View>
          </Row>
          <Row style={{ marginTop: 16 }}>
            <Button
              label={t("Start")}
              primary
              small
              icon="play"
              onPress={() => onStart(w)}
            />
            <Button label={t("Edit")} small onPress={() => onEdit(w)} />
            <Button
              label="↑"
              small
              disabled={index === 0}
              onPress={() => onMove(w, -1)}
            />
            <Button
              label="↓"
              small
              disabled={index === data.workouts.length - 1}
              onPress={() => onMove(w, 1)}
            />
            <Button
              label={t("Delete")}
              small
              danger
              onPress={() => onDelete(w)}
            />
          </Row>
        </Card>
      )}
      ListEmptyComponent={
        <Empty
          icon="barbell-outline"
          title={t("Your first workout awaits.")}
          body={t("Add exercises, sets, reps, weights, time or distance.")}
        />
      }
      ListFooterComponent={
        <T muted size={11} style={{ textAlign: "center", marginTop: 12 }}>
          {t("Stored on your device. Ready when you are.")}
        </T>
      }
    />
  );
}
