import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { randomBytes, randomUUID } from "node:crypto";
import { SCHEMA } from "../src/core/schema";
import {
  challengeState,
  daysUntil,
  move,
  validateWorkout,
  DEFAULT_SETTINGS,
} from "../src/core/model";
import { generateWeek, planPosition, weekDates } from "../src/core/hyrox";
import {
  identityFrom,
  seal,
  open,
  makeInvite,
  parseInvite,
  PORT,
} from "../src/core/protocol";
const alice = identityFrom(randomBytes(32)),
  bob = identityFrom(randomBytes(32)),
  mallory = identityFrom(randomBytes(32));
test("encrypted challenge is readable only by intended peer, with authenticated sender and recipient", () => {
  const m = {
    id: randomUUID(),
    sentAt: Date.now(),
    type: "challenge" as const,
    body: { title: "5km" },
  };
  const packet = seal(alice, bob.publicKey, m, randomBytes);
  assert.deepEqual(open(bob, packet), m);
  assert.throws(() => open(mallory, packet));
  assert.throws(() => open(bob, { ...packet, from: mallory.publicKey }));
  assert.throws(() =>
    open(bob, {
      ...packet,
      box: packet.box.slice(0, -2) + (packet.box.endsWith("00") ? "01" : "00"),
    }),
  );
  assert.throws(() => open(bob, { ...packet, to: mallory.publicKey }));
  assert.notEqual(
    seal(alice, bob.publicKey, m, randomBytes).nonce,
    packet.nonce,
  );
});
test("invitation binds identity to key, validates addresses and rejects malformed inputs", () => {
  const i = {
    v: 1 as const,
    id: alice.id,
    publicKey: alice.publicKey,
    name: "Alice",
    host: "192.168.1.20",
    port: PORT,
  };
  assert.deepEqual(parseInvite(makeInvite(i)), i);
  assert.throws(() => parseInvite(makeInvite({ ...i, id: bob.id })));
  assert.throws(() => parseInvite(makeInvite({ ...i, host: "999.0.0.1" })));
  assert.throws(() => parseInvite("AG-12345"));
  assert.throws(() => parseInvite("PULSE1:***"));
});
function memoryDB() {
  const d = new DatabaseSync(":memory:");
  d.exec(SCHEMA);
  d.prepare("INSERT INTO profile(singleton,settings) VALUES(1,?)").run(
    JSON.stringify(DEFAULT_SETTINGS),
  );
  return d;
}
test("one partner only; requires accepted verified friend; removal clears partner", () => {
  const d = memoryDB();
  const insert = d.prepare(
    "INSERT INTO friends(id,name,publicKey,host,port,status,verified) VALUES(?,?,?,?,?,?,?)",
  );
  insert.run("a", "A", alice.publicKey, "192.168.1.1", PORT, "accepted", 1);
  insert.run("b", "B", bob.publicKey, "192.168.1.2", PORT, "accepted", 1);
  insert.run("m", "M", mallory.publicKey, "192.168.1.3", PORT, "pending", 0);
  const choose = d.prepare("UPDATE profile SET partnerId=? WHERE singleton=1");
  assert.throws(() => choose.run("m"));
  assert.throws(() => choose.run("missing"));
  choose.run("a");
  choose.run("b");
  assert.equal(
    d.prepare("SELECT partnerId FROM profile").get()?.partnerId,
    "b",
  );
  assert.equal(d.prepare("SELECT count(*) n FROM profile").get()?.n, 1);
  assert.throws(() =>
    d.prepare("INSERT INTO profile(singleton,settings) VALUES(2,?)").run("{}"),
  );
  d.prepare("DELETE FROM friends WHERE id=?").run("b");
  assert.equal(
    d.prepare("SELECT partnerId FROM profile").get()?.partnerId,
    null,
  );
  d.close();
});
test("receipt IDs prevent replay; failed transaction does not consume receipt", () => {
  const d = memoryDB();
  d.prepare("INSERT INTO receipts VALUES(?,?)").run("peer:message", 1);
  assert.throws(() =>
    d.prepare("INSERT INTO receipts VALUES(?,?)").run("peer:message", 2),
  );
  d.exec("BEGIN");
  d.prepare("INSERT INTO receipts VALUES(?,?)").run("peer:invalid", 1);
  d.exec("ROLLBACK");
  assert.equal(
    d.prepare("SELECT count(*) n FROM receipts WHERE id=?").get("peer:invalid")
      ?.n,
    0,
  );
  d.close();
});
test("challenge expiration respects boundary and completed/declined terminal states", () => {
  const c = {
    id: "c",
    friendId: "f",
    title: "run",
    kind: "run" as const,
    target: 5,
    deadline: 2000,
    createdAt: 1000,
    direction: "incoming" as const,
    status: "accepted" as const,
    delivered: 1,
  };
  assert.equal(challengeState(c, 1999), "accepted");
  assert.equal(challengeState(c, 2000), "expired");
  assert.equal(
    challengeState({ ...c, status: "completed" }, 3000),
    "completed",
  );
  assert.equal(challengeState({ ...c, status: "declined" }, 3000), "declined");
});
test("date calculations reject rollover and map dates to race phases", () => {
  assert.throws(() => daysUntil("2027-02-30"));
  assert.throws(() => daysUntil("27/02/2027"));
  assert.equal(daysUntil("2027-01-10", new Date("2027-01-01T23:00:00")), 9);
  assert.equal(planPosition("2027-01-10", new Date("2027-01-09")).week, 12);
  assert.equal(planPosition("2027-01-10", new Date("2027-01-11")).past, true);
  assert.equal(weekDates("2027-01-10", 12), "2027-01-04 – 2027-01-10");
});
test("all 72 HYROX variations have valid editable workouts and unique IDs; no automatic race loads", () => {
  for (const level of ["foundation", "regular"] as const)
    for (const trainingDays of [3, 4, 5] as const)
      for (let week = 1; week <= 12; week++) {
        const workouts = generateWeek(
          { level, trainingDays },
          week,
          randomUUID,
        );
        assert.equal(workouts.length, trainingDays);
        const ids = workouts.flatMap((w) => [
          w.id,
          ...w.exercises.map((e) => e.id),
        ]);
        assert.equal(new Set(ids).size, ids.length);
        workouts.forEach((w) => {
          validateWorkout(w);
          assert.ok(w.exercises.every((e) => e.kg === 0));
        });
      }
  const beginner = generateWeek(
    { level: "foundation", trainingDays: 3 },
    1,
    randomUUID,
  );
  const regular = generateWeek(
    { level: "regular", trainingDays: 3 },
    1,
    randomUUID,
  );
  assert.ok(beginner[1].exercises[1].seconds < regular[1].exercises[1].seconds);
});
test("workout validation rejects zero sets, negative loads and no training target", () => {
  const w = generateWeek(
    { level: "regular", trainingDays: 3 },
    1,
    randomUUID,
  )[0];
  assert.throws(() => validateWorkout({ ...w, name: "" }));
  assert.throws(() => validateWorkout({ ...w, exercises: [] }));
  assert.throws(() =>
    validateWorkout({ ...w, exercises: [{ ...w.exercises[1], sets: 0 }] }),
  );
  assert.throws(() =>
    validateWorkout({ ...w, exercises: [{ ...w.exercises[1], kg: -1 }] }),
  );
  assert.throws(() =>
    validateWorkout({ ...w, exercises: [{ ...w.exercises[0], seconds: 0 }] }),
  );
  assert.deepEqual(move(["a", "b", "c"], 2, 0), ["c", "a", "b"]);
  assert.deepEqual(move(["a"], 0, -1), ["a"]);
});

test("oversized outgoing packets are rejected before they can clog the persistent outbox", () => {
  assert.throws(
    () =>
      seal(
        alice,
        bob.publicKey,
        {
          id: randomUUID(),
          sentAt: Date.now(),
          type: "snapshot",
          body: "x".repeat(210000),
        },
        randomBytes,
      ),
    /te groot/,
  );
});
