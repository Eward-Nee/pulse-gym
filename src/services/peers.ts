import * as Crypto from "expo-crypto";
import * as Network from "expo-network";
import {
  uid,
  database,
  serial,
  findFriend,
  snapshot,
  putChallenge,
} from "./db";
import { getIdentity } from "./identity";
import { listen, request, canConnect } from "./transport";
import { notify } from "./notifications";
import {
  makeInvite,
  parseInvite,
  open,
  seal,
  peerId,
  PORT,
  type Invite,
  type Message,
  type Packet,
} from "../core/protocol";
import {
  challengeState,
  validateWorkout,
  type Challenge,
  type Workout,
} from "../core/model";
export { canConnect };
export async function ownInvite() {
  const me = await getIdentity(),
    s = await snapshot();
  const host = await Network.getIpAddressAsync();
  return makeInvite({
    v: 1,
    id: me.id,
    publicKey: me.publicKey,
    name: s.settings.name,
    host,
    port: PORT,
  });
}
async function enqueue(
  friendId: string,
  type: Message["type"],
  body: unknown,
  messageId = uid(),
) {
  const f = await findFriend(friendId);
  if (!f) throw new Error("Vriend nie gevind nie.");
  const me = await getIdentity();
  const packet = seal(
    me,
    f.publicKey,
    { id: messageId, sentAt: Date.now(), type, body },
    Crypto.getRandomBytes,
  );
  await (
    await database()
  ).runAsync(
    "INSERT OR IGNORE INTO outbox VALUES(?,?,?,?)",
    messageId,
    friendId,
    JSON.stringify(packet),
    Date.now(),
  );
  return messageId;
}
export async function addFriend(code: string) {
  const invite = parseInvite(code),
    me = await getIdentity();
  if (invite.id === me.id) throw new Error("Dit is jou eie uitnodiging.");
  const d = await database();
  const old = await findFriend(invite.id);
  await d.runAsync(
    `INSERT INTO friends(id,name,publicKey,host,port,status,verified) VALUES(?,?,?,?,?,'pending',1) ON CONFLICT(id) DO UPDATE SET name=excluded.name,host=excluded.host,port=excluded.port`,
    invite.id,
    invite.name,
    invite.publicKey,
    invite.host,
    invite.port,
  );
  await enqueue(invite.id, "hello", { invite: await ownInvite() });
  return old
    ? "Adres opgedateer; versoek in uitboks."
    : "Vriendskapsversoek in uitboks.";
}
export async function acceptFriend(id: string) {
  const d = await database();
  await d.withTransactionAsync(async () => {
    await d.runAsync(
      "UPDATE friends SET status='accepted',verified=1 WHERE id=?",
      id,
    );
    await enqueue(id, "accepted", { invite: await ownInvite() });
  });
}
export async function sendChallenge(c: Challenge) {
  const f = await findFriend(c.friendId);
  if (!f || f.status !== "accepted" || !f.verified)
    throw new Error("Kies ’n geverifieerde vriend.");
  const d = await database();
  await d.withTransactionAsync(async () => {
    await putChallenge(c);
    await enqueue(
      f.id,
      "challenge",
      { ...c, friendId: undefined, direction: undefined, delivered: undefined },
      c.id,
    );
  });
}
export async function respondChallenge(
  c: Challenge,
  status: "accepted" | "declined" | "completed",
) {
  if (c.direction !== "incoming" || challengeState(c) === "expired")
    throw new Error("Hierdie uitdaging kan nie verander word nie.");
  if (status === "completed" && c.status !== "accepted")
    throw new Error("Aanvaar eers die challenge.");
  if (
    (status === "accepted" || status === "declined") &&
    c.status !== "invited"
  )
    throw new Error("Die uitnodiging is reeds beantwoord.");
  const d = await database();
  await d.withTransactionAsync(async () => {
    await d.runAsync("UPDATE challenges SET status=? WHERE id=?", status, c.id);
    await enqueue(c.friendId, "challenge-status", {
      id: c.id,
      status,
      at: Date.now(),
    });
  });
}
export async function shareSnapshot(id: string) {
  const f = await findFriend(id);
  if (!f || f.status !== "accepted" || !f.verified)
    throw new Error("Verifieer eers die vriend.");
  const s = await snapshot();
  await enqueue(id, "snapshot", {
    templates: f.shareTemplates ? s.workouts.slice(0, 30) : [],
    history: f.shareHistory ? s.sessions.slice(0, 30) : [],
  });
}
let flushing = false;
export async function flush() {
  if (flushing || !canConnect()) return 0;
  flushing = true;
  let sent = 0;
  try {
    const d = await database(),
      me = await getIdentity();
    const failed = new Set<string>();
    const pending = await d.getAllAsync<{
      id: string;
      friendId: string;
      packet: string;
    }>("SELECT * FROM outbox ORDER BY createdAt,rowid LIMIT 30");
    for (const row of pending) {
      if (failed.has(row.friendId)) continue;
      const expired = await d.getFirstAsync(
        "SELECT id FROM challenges WHERE id=? AND deadline<=?",
        row.id,
        Date.now(),
      );
      if (expired) {
        await serial(() => d.runAsync("DELETE FROM outbox WHERE id=?", row.id));
        continue;
      }
      const f = await findFriend(row.friendId);
      if (!f) continue;
      try {
        const reply = JSON.parse(
          await request(f.host, f.port, row.packet),
        ) as Packet;
        if (reply.from !== f.publicKey)
          throw new Error("Verkeerde antwoord-sleutel.");
        const ack = open(me, reply);
        if (ack.type !== "ack" || (ack.body as any)?.id !== row.id)
          throw new Error("Geen geldige ontvangsbevestiging.");
        await serial(async () => {
          await d.runAsync("DELETE FROM outbox WHERE id=?", row.id);
          await d.runAsync(
            "UPDATE challenges SET delivered=1 WHERE id=?",
            row.id,
          );
        });
        sent++;
      } catch {
        failed.add(
          row.friendId,
        ); /* Retry reachable peers without one offline friend blocking the queue. */
      }
    }
    return sent;
  } finally {
    flushing = false;
  }
}
async function receive(line: string) {
  const me = await getIdentity();
  const packet = JSON.parse(line) as Packet;
  const m = open(me, packet),
    sender = peerId(packet.from),
    receipt = sender + ":" + m.id;
  const d = await database();
  let alert = "";
  await serial(() =>
    d.withTransactionAsync(async () => {
      if (await d.getFirstAsync("SELECT id FROM receipts WHERE id=?", receipt))
        return;
      const f = await findFriend(sender);
      const b = m.body as any;
      if (m.type === "hello") {
        if (!b || typeof b.invite !== "string")
          throw new Error("Ongeldige uitnodiging.");
        const invite = parseInvite(b.invite);
        if (invite.publicKey !== packet.from)
          throw new Error("Sleutel pas nie.");
        const count = await d.getFirstAsync<{ n: number }>(
          "SELECT count(*) n FROM friends",
        );
        if (!f && (count?.n || 0) >= 50) throw new Error("Vriendelys vol.");
        await d.runAsync(
          `INSERT INTO friends(id,name,publicKey,host,port,status) VALUES(?,?,?,?,?,'pending') ON CONFLICT(id) DO UPDATE SET host=excluded.host,port=excluded.port`,
          sender,
          invite.name,
          packet.from,
          invite.host,
          invite.port,
        );
        alert = "Nuwe vriendskapsversoek: " + invite.name;
      } else {
        if (!f) throw new Error("Onbekende afsender.");
        if (m.type === "accepted") {
          if (!f.verified) throw new Error("Verifieer die uitnodiging.");
          const invite = parseInvite(b?.invite);
          if (invite.publicKey !== packet.from)
            throw new Error("Sleutel pas nie.");
          await d.runAsync(
            "UPDATE friends SET status='accepted',host=?,port=? WHERE id=?",
            invite.host,
            invite.port,
            sender,
          );
        } else {
          if (f.status !== "accepted" || !f.verified)
            throw new Error("Vriend is nog nie geverifieer nie.");
          if (m.type === "challenge") {
            if (
              !b ||
              b.id !== m.id ||
              typeof b.title !== "string" ||
              !b.title.trim() ||
              b.title.length > 100 ||
              !["run", "exercise", "workout"].includes(b.kind) ||
              !Number.isFinite(b.target) ||
              b.target <= 0 ||
              b.target > 100000 ||
              !Number.isFinite(b.deadline) ||
              !Number.isFinite(b.createdAt) ||
              b.createdAt > m.sentAt + 1000 ||
              b.deadline <= b.createdAt ||
              b.deadline - b.createdAt > 7 * 86400000 ||
              b.deadline <= Date.now() ||
              b.status !== "invited"
            )
              throw new Error("Ongeldige of verstreke challenge.");
            await putChallenge({
              ...b,
              friendId: sender,
              direction: "incoming",
              status: "invited",
              delivered: 1,
            });
            alert = f.name + " daag jou uit: " + b.title;
          } else if (m.type === "challenge-status") {
            if (
              !b ||
              typeof b.id !== "string" ||
              !["accepted", "declined", "completed"].includes(b.status) ||
              !Number.isFinite(b.at) ||
              b.at > m.sentAt + 1000
            )
              throw new Error("Ongeldige status.");
            const c = await d.getFirstAsync<Challenge>(
              "SELECT * FROM challenges WHERE id=? AND friendId=? AND direction='outgoing'",
              b.id,
              sender,
            );
            if (!c) throw new Error("Challenge onbekend.");
            if (b.at > c.deadline) throw new Error("Sperdatum verby.");
            const legal =
              (c.status === "invited" &&
                (b.status === "accepted" || b.status === "declined")) ||
              (c.status === "accepted" && b.status === "completed");
            if (legal)
              await d.runAsync(
                "UPDATE challenges SET status=? WHERE id=?",
                b.status,
                c.id,
              );
          } else if (m.type === "snapshot") {
            if (
              !b ||
              !Array.isArray(b.templates) ||
              !Array.isArray(b.history) ||
              b.templates.length > 30 ||
              b.history.length > 30
            )
              throw new Error("Ongeldige deelpakket.");
            for (const w of b.templates) validateWorkout(w as Workout);
            for (const h of b.history) {
              if (
                typeof h.name !== "string" ||
                h.name.length > 80 ||
                !Number.isFinite(h.finishedAt) ||
                !Number.isFinite(h.seconds) ||
                h.seconds < 0
              )
                throw new Error("Ongeldige geskiedenis.");
            }
            await d.runAsync(
              "UPDATE friends SET templates=?,history=?,syncedAt=? WHERE id=?",
              JSON.stringify(b.templates),
              JSON.stringify(b.history),
              Date.now(),
              sender,
            );
          } else throw new Error("Onverwagte boodskap.");
        }
      }
      await d.runAsync("INSERT INTO receipts VALUES(?,?)", receipt, Date.now());
    }),
  );
  if (alert) void notify("Pulse Gym", alert).catch(() => {});
  return JSON.stringify(
    seal(
      me,
      packet.from,
      { id: uid(), sentAt: Date.now(), type: "ack", body: { id: m.id } },
      Crypto.getRandomBytes,
    ),
  );
}
export async function startPeers(
  onChange: () => void,
  onError: (e: Error) => void,
) {
  return listen(async (line) => {
    const reply = await receive(line);
    onChange();
    return reply;
  }, onError);
}
