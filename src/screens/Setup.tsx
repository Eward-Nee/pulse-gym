import React, { useState } from "react";
import appConfig from "../../app.json";
import {
  Image,
  Linking,
  Platform,
  ScrollView,
  Share,
  Switch,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
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
  useTheme,
} from "../components/ui";
import {
  type Snapshot,
  type Settings,
  type Workout,
  exerciseSummary,
} from "../core/model";
import { parseInvite, fingerprint, type Invite } from "../core/protocol";
import { getIdentity } from "../services/identity";
import { setPartner, updateSettings, permissions, uid } from "../services/db";
import {
  acceptFriend,
  addFriend,
  canConnect,
  ownInvite,
  shareSnapshot,
} from "../services/peers";
import { useNotificationPermission } from "../services/notifications";
import {
  checkRelease,
  installRelease,
  type Release,
} from "../services/updates";
export type Act = (task: () => Promise<unknown>, message?: string) => void;
export default function Setup({
  data,
  act,
  onRemove,
  onImport,
  onHyrox,
  networkStatus,
}: {
  data: Snapshot;
  act: Act;
  onRemove: (id: string) => void;
  onImport: (w: Workout) => void;
  onHyrox: () => void;
  networkStatus: string;
}) {
  const { c } = useTheme();
  const notifications = useNotificationPermission();
  const [name, setName] = useState(data.settings.name),
    [code, setCode] = useState(""),
    [invite, setInvite] = useState<Invite | null>(null),
    [myCode, setMyCode] = useState(""),
    [id, setId] = useState(""),
    [friendId, showFriend] = useState<string | null>(null),
    [release, setRelease] = useState<Release | null>(null),
    [working, setWorking] = useState(false),
    [note, setNote] = useState("");
  const friend = data.friends.find((f) => f.id === friendId),
    partner = data.friends.find((f) => f.id === data.partnerId),
    eligible = data.friends.filter(
      (f) => f.status === "accepted" && f.verified,
    );
  const patch = (partial: Partial<Settings>) =>
    act(() => updateSettings(partial));
  return (
    <ScrollView
      contentContainerStyle={{ padding: 22, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
    >
      <Label>JOU RUIMTE / JOU REËLS</Label>
      <Heading
        title="Make it yours."
        subtitle="Kies jou voorkoms. Bring jou mense."
      />
      <Card>
        <Row>
          <Image
            source={require("../../assets/icon.png")}
            style={{ width: 54, height: 54, borderRadius: 16 }}
          />
          <View>
            <T size={20} bold>
              Pulse Gym
            </T>
            <T muted size={12}>
              Privaat. Plaaslik. Persoonlik.
            </T>
          </View>
        </Row>
        <View style={{ marginTop: 18 }}>
          <Field
            label="Jou naam"
            value={name}
            maxLength={60}
            onChangeText={setName}
          />
          <Button
            small
            label="Stoor naam"
            onPress={() => {
              if (name.trim()) patch({ name: name.trim() });
            }}
          />
        </View>
      </Card>
      <Label>TEMA</Label>
      <Row style={{ marginBottom: 18 }}>
        <Chip
          label="Pulse Social"
          selected={data.settings.theme === "pulse"}
          onPress={() => patch({ theme: "pulse" })}
        />
        <Chip
          label="♥ Couples"
          selected={data.settings.theme === "couples"}
          onPress={() => patch({ theme: "couples" })}
        />
      </Row>
      <Card>
        <Row style={{ justifyContent: "space-between" }}>
          <T size={18} bold>
            Jou partner
          </T>
          <Pill>Max. 1</Pill>
        </Row>
        <T muted size={12} style={{ marginVertical: 10 }}>
          Kies een aanvaarde, geverifieerde vriend. Die Couples-tema werk ook
          voordat jy ’n partner kies.
        </T>
        <Row>
          <Chip
            label="Geen partner"
            selected={!data.partnerId}
            onPress={() => act(() => setPartner(null), "Partner ontkoppel.")}
          />
          {eligible.map((f) => (
            <Chip
              key={f.id}
              label={f.name}
              selected={f.id === data.partnerId}
              onPress={() =>
                act(
                  () => setPartner(f.id),
                  `${f.name} is nou jou enigste partner.`,
                )
              }
            />
          ))}
        </Row>
        {partner && (
          <T style={{ color: c.accent }} bold>
            {data.settings.name} ♥ {partner.name}
          </T>
        )}
        {!eligible.length && (
          <T muted size={12}>
            Voeg ’n vriend hieronder by en verifieer die sleutel.
          </T>
        )}
      </Card>
      <Label>WALLPAPER</Label>
      <Row style={{ marginBottom: 18 }}>
        {(
          [
            ["iron", "Iron / warm"],
            ["steel", "Steel / koel"],
            ["plain", "Rustig / solied"],
          ] as const
        ).map(([wallpaper, label]) => (
          <Chip
            key={wallpaper}
            label={label}
            selected={data.settings.wallpaper === wallpaper}
            onPress={() => patch({ wallpaper })}
          />
        ))}
      </Row>
      <Card>
        <Row style={{ justifyContent: "space-between" }}>
          <T>Verminder animasie</T>
          <Switch
            value={data.settings.reducedMotion}
            onValueChange={(reducedMotion) => patch({ reducedMotion })}
            trackColor={{ true: c.accent }}
          />
        </Row>
      </Card>
      <Card>
        <Label>HYROX MIXED DOUBLES</Label>
        <T bold>{data.settings.raceDate || "Jou wedrendatum wag."}</T>
        <T muted size={12} style={{ marginVertical: 10 }}>
          Beginner- of gereelde oefenbasis, 3–5 dae en redigeerbare
          weekprogramme.
        </T>
        <Button
          label="Stel datum & program"
          icon="calendar-outline"
          onPress={onHyrox}
        />
      </Card>
      <Heading
        title="Jou mense."
        subtitle="Koppel direk. Geen sentrale vriendedatabasis nie."
      />
      <Card>
        <Label>DIREKTE VERBINDING</Label>
        <T size={12} muted>
          {networkStatus}
        </T>
        <T muted size={12} style={{ marginTop: 8 }}>
          Gebruik dieselfde Wi-Fi, met albei apps oop. Die lang uitnodigingskode
          bevat jou deelbare ID, publieke sleutel en netwerkadres. ’n Kort ID
          alleen kan nie ’n foon op die internet opspoor nie.
        </T>
        {!canConnect() && (
          <T muted size={12} style={{ marginTop: 8 }}>
            {Platform.OS === "web"
              ? "Hierdie blaaierweergawe is vir jou eie workouts en ontwerpbeoordeling. Koppeling vereis die native bou."
              : "Direkte sockets vereis ’n ontwikkelings- of vrystellingsbou; Expo Go bevat dit nie."}
          </T>
        )}
        <View style={{ marginTop: 14 }}>
          <Button
            label="Wys my ID"
            onPress={() =>
              act(async () => {
                setId((await getIdentity()).id);
              })
            }
          />
        </View>
        {!!id && (
          <T size={12} style={{ marginTop: 10 }} selectable>
            {id}
          </T>
        )}
        <View style={{ marginTop: 10 }}>
          <Button
            label="Skep uitnodigingskode"
            icon="share-social-outline"
            disabled={!canConnect()}
            onPress={() => act(async () => setMyCode(await ownInvite()))}
          />
        </View>
        {!!myCode && (
          <>
            <Field
              label="Jou uitnodiging"
              value={myCode}
              multiline
              editable={false}
            />
            <Row>
              <Button
                small
                label="Kopieer"
                onPress={() =>
                  act(
                    () => Clipboard.setStringAsync(myCode),
                    "Uitnodiging gekopieer.",
                  )
                }
              />
              <Button
                small
                label="Deel"
                onPress={() => act(() => Share.share({ message: myCode }))}
              />
            </Row>
          </>
        )}
      </Card>
      <Card>
        <Field
          label="Voeg vriend by via uitnodigingskode"
          placeholder="PULSE1:…"
          value={code}
          multiline
          autoCapitalize="none"
          onChangeText={setCode}
        />
        <Button
          label="Lees uitnodiging"
          disabled={!canConnect()}
          onPress={() =>
            act(async () => {
              setInvite(parseInvite(code.trim()));
            })
          }
        />
      </Card>
      {data.friends.length === 0 && (
        <Empty
          icon="people-outline"
          title="Maak jou kring oop."
          body="Deel jou kode met ’n vriend. Bevestig dan mekaar se sleutelvingerafdruk."
        />
      )}
      {data.friends.map((f) => (
        <Card key={f.id}>
          <Row style={{ justifyContent: "space-between" }}>
            <View>
              <T bold size={18}>
                {f.name}
                {f.id === data.partnerId ? " ♥" : ""}
              </T>
              <T muted size={11}>
                {f.status === "accepted" ? "Vriend" : "Wag op aanvaarding"} ·{" "}
                {f.verified ? "sleutel geverifieer" : "sleutel onbevestig"}
              </T>
            </View>
            <Button label="Bekyk" small onPress={() => showFriend(f.id)} />
          </Row>
        </Card>
      ))}
      <Card>
        <Label>KENNISGEWINGS</Label>
        <T muted size={12} style={{ marginBottom: 12 }}>
          Ontvang ’n plaaslike kennisgewing wanneer ’n direkte challenge aankom,
          en ’n herinnering by die sperdatum. ’n Geslote app word nie sonder ’n
          push-diens wakker gemaak nie.
        </T>
        {notifications.status === "enabled" ? (
          <Pill>Kennisgewings geaktiveer</Pill>
        ) : notifications.status === "unsupported" ? (
          <T muted>Kennisgewings is beskikbaar in die Android-app.</T>
        ) : (
          <>
            {notifications.status === "error" && (
              <T muted>Kon nie toestemming nagaan nie. Probeer weer.</T>
            )}
            {notifications.status === "blocked" && (
              <T muted>
                Laat kennisgewings in jou foon se app-instellings toe.
              </T>
            )}
            <Button
              label={
                notifications.status === "checking"
                  ? "Kontroleer toestemming…"
                  : notifications.status === "blocked"
                    ? "Open kennisgewing-instellings"
                    : notifications.status === "error"
                      ? "Probeer weer"
                      : "Aktiveer kennisgewings"
              }
              icon="notifications-outline"
              disabled={notifications.status === "checking"}
              onPress={() =>
                act(async () => {
                  if (notifications.status === "blocked")
                    await Linking.openSettings();
                  else if (notifications.status === "error")
                    await notifications.refresh();
                  else await notifications.enable();
                })
              }
            />
          </>
        )}
      </Card>
      <Card>
        <Label>APP-OPDATERINGS</Label>
        <T muted size={12} style={{ marginBottom: 12 }}>
          Soek die jongste Pulse Gym-weergawe. Geen opstelling nodig nie.
        </T>
        <Button
          label={working ? "Kontroleer…" : "Soek opdatering"}
          disabled={working}
          icon="download-outline"
          onPress={() => {
            setWorking(true);
            act(async () => {
              try {
                const result = await checkRelease();
                setRelease(result);
              } finally {
                setWorking(false);
              }
            });
          }}
        />
        {release && (
          <View style={{ marginTop: 16 }}>
            <T bold>
              {release.version} ·{" "}
              {release.newer
                ? "Nuwe weergawe beskikbaar"
                : "Geen nuwer stabiele weergawe nie"}
            </T>
            <T muted size={12} style={{ marginVertical: 10 }}>
              {release.notes}
            </T>
            {release.newer && (
              <Button
                label={
                  working
                    ? "Laai af & verifieer…"
                    : release.apk && Platform.OS === "android"
                      ? "Laai APK af & open installeerder"
                      : "Open GitHub-release"
                }
                disabled={working}
                onPress={() => {
                  setWorking(true);
                  act(async () => {
                    try {
                      await installRelease(release);
                    } finally {
                      setWorking(false);
                    }
                  });
                }}
              />
            )}
          </View>
        )}
        <T muted size={11} style={{ marginTop: 12 }}>
          Installeer ’n geboude release, nie bronkode nie. Android bevestig die
          installasie; iPhone-verspreiding benodig Apple se ondersteunde roete.
        </T>
      </Card>
      {!!note && <T style={{ color: c.accent }}>{note}</T>}
      <T size={11} muted style={{ textAlign: "center" }}>
        Pulse Gym {appConfig.expo.version} · SQLite op jou toestel
      </T>
      {invite && (
        <Sheet title="Verifieer jou vriend" onClose={() => setInvite(null)}>
          <Heading title={invite.name} subtitle={invite.id} />
          <Label>PUBLIEKE SLEUTELVINGERAFDRUK</Label>
          <T selectable size={12}>
            {fingerprint(invite.publicKey)}
          </T>
          <T muted style={{ marginVertical: 20 }}>
            Vergelyk die volle kode met jou vriend deur ’n kanaal wat jy
            vertrou. Voeg net die vriend by as dit ooreenstem.
          </T>
          <Button
            primary
            label="Sleutel stem ooreen · stuur versoek"
            onPress={() =>
              act(async () => {
                await addFriend(code.trim());
                setInvite(null);
                setCode("");
              }, "Versoek in uitboks. Jou vriend moet dit aanvaar.")
            }
          />
        </Sheet>
      )}
      {friend && (
        <Sheet title={friend.name} onClose={() => showFriend(null)}>
          <Pill>
            {friend.id === data.partnerId
              ? "Jou partner"
              : friend.status === "accepted"
                ? "Jou vriend"
                : "Vriendskapsversoek"}
          </Pill>
          <Label>PUBLIEKE SLEUTELVINGERAFDRUK</Label>
          <T selectable size={12}>
            {fingerprint(friend.publicKey)}
          </T>
          {friend.status === "pending" && (
            <>
              <T muted style={{ marginVertical: 16 }}>
                Vergelyk die volle vingerafdruk met jou vriend voor aanvaarding.
              </T>
              <Button
                primary
                label="Geverifieer · aanvaar vriend"
                onPress={() =>
                  act(
                    () => acceptFriend(friend.id),
                    "Vriend aanvaar. Bevestiging in uitboks.",
                  )
                }
              />
            </>
          )}
          <Card style={{ marginTop: 20 }}>
            <Label>JOU DEELTOESTEMMING</Label>
            <Row style={{ justifyContent: "space-between", marginBottom: 12 }}>
              <T>My templates</T>
              <Switch
                disabled={friend.status !== "accepted"}
                value={!!friend.shareTemplates}
                onValueChange={(v) =>
                  act(async () => {
                    await permissions(friend.id, v, !!friend.shareHistory);
                    await shareSnapshot(friend.id);
                  }, "Deelvoorkeur gestoor; sinkronisering in uitboks.")
                }
              />
            </Row>
            <Row style={{ justifyContent: "space-between" }}>
              <T>My geskiedenis</T>
              <Switch
                disabled={friend.status !== "accepted"}
                value={!!friend.shareHistory}
                onValueChange={(v) =>
                  act(async () => {
                    await permissions(friend.id, !!friend.shareTemplates, v);
                    await shareSnapshot(friend.id);
                  }, "Deelvoorkeur gestoor; sinkronisering in uitboks.")
                }
              />
            </Row>
            <T muted size={11} style={{ marginVertical: 12 }}>
              Afskakel stuur ’n leë gedeelde aansig by die volgende verbinding.
              Reeds ingevoerde kopieë kan nie teruggetrek word nie.
            </T>
            <Button
              label="Deel nuutste weergawe"
              disabled={friend.status !== "accepted"}
              onPress={() =>
                act(
                  () => shareSnapshot(friend.id),
                  "Nuutste gedeelde data in uitboks.",
                )
              }
            />
          </Card>
          <Label>VRIEND SE GEDEELDE TEMPLATES</Label>
          {friend.templates.length ? (
            friend.templates.map((w) => (
              <Card key={w.id}>
                <T bold>{w.name}</T>
                <T muted size={12}>
                  {w.exercises.length} oefeninge
                </T>
                <Button
                  small
                  label="Gebruik template"
                  onPress={() =>
                    onImport({
                      ...w,
                      id: uid(),
                      exercises: w.exercises.map((e) => ({ ...e, id: uid() })),
                    })
                  }
                />
              </Card>
            ))
          ) : (
            <T muted>Jou vriend het nog geen templates gedeel nie.</T>
          )}
          <Label>VRIEND SE GEDEELDE GESKIEDENIS</Label>
          {friend.history.length ? (
            friend.history.map((h, i) => (
              <View key={i} style={{ marginBottom: 12 }}>
                <T bold>{h.name}</T>
                <T muted size={12}>
                  {new Date(h.finishedAt).toLocaleDateString()} ·{" "}
                  {Math.round(h.seconds / 60)} min
                </T>
              </View>
            ))
          ) : (
            <T muted>Nog geen gedeelde geskiedenis nie.</T>
          )}
          {!!friend.syncedAt && (
            <T muted size={11}>
              Laas ontvang: {new Date(friend.syncedAt).toLocaleString()}
            </T>
          )}
          <View style={{ marginTop: 24 }}>
            <Button
              label="Verwyder vriend"
              danger
              onPress={() => {
                showFriend(null);
                onRemove(friend.id);
              }}
            />
          </View>
        </Sheet>
      )}
    </ScrollView>
  );
}
