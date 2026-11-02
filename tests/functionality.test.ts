import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { build } from "esbuild";
import { notificationController } from "../src/core/notificationPermission";

// Bundle as Metro/browser would: "buffer" resolves to the actual mobile polyfill,
// not Node's built-in Buffer. Real app DB/protocol/peer/update code stays intact.
const bundled = build({
  stdin: {
    contents: `export * from './src/core/protocol'; export * from './src/services/db'; export * from './src/services/peers'; export * from './src/services/updates'; export * from './src/services/notifications';`,
    resolveDir: process.cwd(),
    loader: "ts",
  },
  bundle: true,
  platform: "browser",
  format: "cjs",
  write: false,
  plugins: [
    {
      name: "native-boundaries",
      setup(b) {
        const mocks: Record<string, string> = {
          "expo-crypto":
            "export const randomUUID=__test.randomUUID, getRandomBytes=__test.randomBytes;",
          "expo-network":
            "export const getIpAddressAsync=async()=>__test.host;",
          "expo-sqlite": "export const openDatabaseAsync=async()=>__test.db;",
          "expo-secure-store":
            "export const WHEN_UNLOCKED_THIS_DEVICE_ONLY=1; export const getItemAsync=async k=>__test.keys.get(k); export const setItemAsync=async(k,v)=>__test.keys.set(k,v);",
          "expo-notifications":
            "export const AndroidImportance={HIGH:4}; export const SchedulableTriggerInputTypes={DATE:'date'}; export const setNotificationHandler=()=>{}; export const getPermissionsAsync=async()=>__test.permission; export const requestPermissionsAsync=async()=>__test.permission; export const setNotificationChannelAsync=async()=>{}; export const scheduleNotificationAsync=async n=>{__test.notifications.push(n)}; export const cancelScheduledNotificationAsync=async id=>{__test.cancelled.push(id)};",
          "react-native":
            "export const Platform={OS:'android'}, Linking={openURL:async u=>__test.links.push(u)}, AppState={addEventListener:()=>({remove(){}})};",
          "expo-constants": "export default {expoConfig:{version:'0.1.0'}};",
          "expo-file-system/legacy":
            "export const cacheDirectory='cache/'; export const downloadAsync=async()=>{}; export const deleteAsync=async()=>{__test.deleted=true}; export const getContentUriAsync=async()=> 'content://pulse/update.apk';",
          "expo-file-system":
            "export class File {get size(){return __test.apk.length} open(){return {offset:0,readBytes(n){const b=__test.apk.subarray(this.offset,this.offset+n);this.offset+=n;return b},close(){}}}}",
          "expo-intent-launcher":
            "export const startActivityAsync=async(a,o)=>__test.installs.push({a,o});",
          "./transport":
            "export const canConnect=()=>true; export const listen=async f=>{__test.receive=f;return()=>{}}; export const request=async(h,p,line)=>__test.request(h,line);",
        };
        b.onResolve({ filter: /^(expo-|react-native$|\.\/transport$)/ }, (a) =>
          a.path in mocks ? { path: a.path, namespace: "mock" } : undefined,
        );
        b.onLoad({ filter: /.*/, namespace: "mock" }, (a) => ({
          contents: mocks[a.path],
          loader: "js",
        }));
      },
    },
  ],
});
async function device(host: string) {
  const sqlite = new DatabaseSync(":memory:");
  const env: any = {
    host,
    keys: new Map(),
    randomUUID,
    randomBytes,
    notifications: [],
    cancelled: [],
    links: [],
    installs: [],
    apk: new Uint8Array([1, 2, 3]),
    permission: { granted: true, canAskAgain: true },
  };
  env.db = {
    execAsync: async (s: string) => sqlite.exec(s),
    runAsync: async (s: string, ...p: any[]) => sqlite.prepare(s).run(...p),
    getFirstAsync: async (s: string, ...p: any[]) =>
      sqlite.prepare(s).get(...p) ?? null,
    getAllAsync: async (s: string, ...p: any[]) => sqlite.prepare(s).all(...p),
    withTransactionAsync: async (f: () => Promise<unknown>) => {
      sqlite.exec("BEGIN");
      try {
        await f();
        sqlite.exec("COMMIT");
      } catch (e) {
        sqlite.exec("ROLLBACK");
        throw e;
      }
    },
  };
  const module = { exports: {} as any };
  new Function(
    "__test",
    "module",
    "exports",
    "fetch",
    (await bundled).outputFiles[0].text,
  )(env, module, module.exports, (...args: any[]) => env.fetch(...args));
  const app = module.exports;
  await app.initDB();
  return { app, env, sqlite };
}
test("mobile Buffer invitations: unicode, all padding lengths, legacy compatibility and malformed data", async () => {
  const { app, sqlite } = await device("192.168.1.10");
  const id = app.identityFrom(randomBytes(32));
  for (const name of ["Zoë ♥", "René 🏋️", "A", "AB", "ABC"]) {
    const invite = {
      v: 1,
      ...id,
      privateKey: undefined,
      name,
      host: "192.168.1.10",
      port: 47478,
    };
    const canonical = JSON.parse(JSON.stringify(invite));
    const code = app.makeInvite(invite);
    assert.equal(
      code,
      "PULSE1:" + Buffer.from(JSON.stringify(invite)).toString("base64url"),
    );
    assert.deepEqual(app.parseInvite(code), canonical);
    assert.throws(() => app.parseInvite(code + "="));
  }
  for (const value of [null, {}, [], { v: 1, host: 42 }, "test"])
    assert.throws(() =>
      app.parseInvite(
        "PULSE1:" + Buffer.from(JSON.stringify(value)).toString("base64url"),
      ),
    );
  for (const code of ["PULSE1:A", "PULSE1:***", null, undefined, "AG-123"])
    assert.throws(() => app.parseInvite(code));
  sqlite.close();
});
test("actual SQLite services: workout/exercise CRUD, reorder, settings, session history and restart persistence", async () => {
  const { app, env, sqlite } = await device("192.168.1.10");
  let s = await app.snapshot();
  assert.equal(s.workouts.length, 2);
  const w = {
    ...s.workouts[0],
    id: randomUUID(),
    name: "Edited",
    position: 2,
    exercises: [...s.workouts[0].exercises].reverse(),
  };
  await app.putWorkout(w);
  w.exercises[0].reps = 12;
  w.exercises.pop();
  await app.putWorkout(w);
  await app.orderWorkouts([w.id, ...s.workouts.map((x: any) => x.id)]);
  s = await app.snapshot();
  assert.equal(s.workouts[0].id, w.id);
  assert.equal(s.workouts[0].exercises.length, 1);
  assert.equal(s.workouts[0].exercises[0].reps, 12);
  await app.updateSettings({
    ...s.settings,
    name: "Zoë",
    theme: "couples",
    raceDate: "2027-04-01",
  });
  await app.storeSession({
    id: randomUUID(),
    name: w.name,
    finishedAt: Date.now(),
    seconds: 120,
    exercises: w.exercises,
    completedSets: { [w.exercises[0].id]: 1 },
  });
  await env.db.runAsync(
    "INSERT INTO active_session VALUES(1,?)",
    JSON.stringify({ workout: w, completedSets: {} }),
  );
  await app.initDB();
  s = await app.snapshot();
  assert.equal(s.settings.name, "Zoë");
  assert.equal(s.settings.theme, "couples");
  assert.equal(s.sessions.length, 1);
  assert.equal(
    JSON.parse(
      (await env.db.getFirstAsync("SELECT state FROM active_session")).state,
    ).workout.id,
    w.id,
  );
  await app.deleteWorkout(w.id);
  assert.equal((await app.snapshot()).workouts.length, 2);
  assert.equal((await app.snapshot()).sessions.length, 1);
  sqlite.close();
});
test("two isolated app instances: pairing, verification, partner, encrypted challenges, replay, offline retry, sharing and removal", async () => {
  const a = await device("192.168.1.10"),
    b = await device("192.168.1.11");
  a.env.request = async (_: string, line: string) => b.env.receive(line);
  b.env.request = async (_: string, line: string) => a.env.receive(line);
  await a.app.startPeers(
    () => {},
    () => {},
  );
  await b.app.startPeers(
    () => {},
    () => {},
  );
  const ai = a.app.parseInvite(await a.app.ownInvite()),
    bi = b.app.parseInvite(await b.app.ownInvite());
  await assert.rejects(a.app.addFriend(await a.app.ownInvite()));
  await a.app.addFriend(await b.app.ownInvite());
  assert.equal(await a.app.flush(), 1);
  await assert.rejects(b.app.setPartner(ai.id));
  await b.app.acceptFriend(ai.id);
  await b.app.flush();
  assert.equal((await a.app.findFriend(bi.id)).status, "accepted");
  await a.app.setPartner(bi.id);
  await b.app.setPartner(ai.id);
  const now = Date.now(),
    c = {
      id: randomUUID(),
      friendId: bi.id,
      title: "5km",
      kind: "run",
      target: 5000,
      createdAt: now,
      deadline: now + 3600000,
      direction: "outgoing",
      status: "invited",
      delivered: 0,
    };
  await a.app.sendChallenge(c);
  const packet = (await a.env.db.getFirstAsync("SELECT packet FROM outbox"))
    .packet;
  a.env.request = async () => {
    throw Error("offline");
  };
  assert.equal(await a.app.flush(), 0);
  assert.equal((await a.app.snapshot()).pendingCount, 1);
  a.env.request = async (_: string, line: string) => b.env.receive(line);
  assert.equal(await a.app.flush(), 1);
  await b.env.receive(packet);
  assert.equal((await b.app.snapshot()).challenges.length, 1);
  assert.equal((await a.app.snapshot()).challenges[0].delivered, 1);
  let incoming = (await b.app.snapshot()).challenges[0];
  await assert.rejects(b.app.respondChallenge(incoming, "completed"));
  await b.app.respondChallenge(incoming, "accepted");
  await b.app.flush();
  incoming = (await b.app.snapshot()).challenges[0];
  await b.app.respondChallenge(incoming, "completed");
  await b.app.flush();
  assert.equal((await a.app.snapshot()).challenges[0].status, "completed");
  await a.app.permissions(bi.id, true, true);
  await a.app.shareSnapshot(bi.id);
  await a.app.flush();
  assert.equal((await b.app.findFriend(ai.id)).templates.length, 2);
  await a.app.permissions(bi.id, false, false);
  await a.app.shareSnapshot(bi.id);
  await a.app.flush();
  assert.equal((await b.app.findFriend(ai.id)).templates.length, 0);
  await a.app.sendChallenge({
    ...c,
    id: randomUUID(),
    createdAt: now - 7200000,
    deadline: now - 3600000,
  });
  await a.app.flush();
  assert.equal((await a.app.snapshot()).pendingCount, 0);
  assert.ok(b.env.notifications.length >= 2);
  await a.app.removeFriend(bi.id);
  assert.equal((await a.app.snapshot()).partnerId, null);
  assert.equal((await a.app.snapshot()).challenges.length, 0);
  a.sqlite.close();
  b.sqlite.close();
});
test("notification controller: grant hides activation, re-entry/revocation, blocked, unsupported, errors and stale reads", async () => {
  let permission = { granted: false, canAskAgain: true };
  const states: string[] = [];
  const adapter = {
    supported: true,
    read: async () => permission,
    request: async () => (permission = { granted: true, canAskAgain: true }),
  };
  const c = notificationController(adapter, (s) => states.push(s));
  await c.refresh();
  assert.equal(states.at(-1), "disabled");
  await c.enable();
  assert.equal(states.at(-1), "enabled");
  await c.refresh();
  assert.equal(states.at(-1), "enabled");
  permission = { granted: false, canAskAgain: false };
  await c.refresh();
  assert.equal(states.at(-1), "blocked");
  adapter.read = async () => {
    throw Error("OS unavailable");
  };
  await c.refresh();
  assert.equal(states.at(-1), "error");
  let resolve: any;
  adapter.read = () => new Promise((r) => (resolve = r));
  const pending = c.refresh();
  await c.enable();
  resolve({ granted: false, canAskAgain: true });
  await pending;
  assert.equal(states.at(-1), "enabled");
  c.dispose();
  const n = states.length;
  await c.refresh();
  assert.equal(states.length, n);
  const web = notificationController({ ...adapter, supported: false }, (s) =>
    states.push(s),
  );
  await web.refresh();
  assert.equal(states.at(-1), "unsupported");
});
test("notification service: permission denial, receipt notification, deadline scheduling and cancellation", async () => {
  const { app, env, sqlite } = await device("192.168.1.10");
  env.permission.granted = false;
  await app.notify("title", "body");
  await app.remind("id", Date.now() + 5000, "run");
  assert.equal(env.notifications.length, 0);
  env.permission.granted = true;
  await app.notify("title", "body");
  await app.remind("id", Date.now() + 5000, "run");
  assert.equal(env.notifications.length, 2);
  assert.equal(env.notifications[1].trigger.channelId, "challenges");
  await app.remind("old", Date.now() - 1, "expired");
  assert.equal(env.notifications.length, 2);
  await app.cancelReminder("id");
  assert.ok(env.cancelled.includes("id"));
  sqlite.close();
});
test("Android update install: valid hash opens installer, corrupted hash stops it; semver comparison", async () => {
  const { app, env, sqlite } = await device("192.168.1.10");
  assert.equal(app.newerVersion("v0.1.1", "0.1.0"), true);
  assert.equal(app.newerVersion("v0.1.0", "0.1.1"), false);
  assert.equal(app.newerVersion("invalid", "0.1.0"), false);
  const release = {
    version: "v0.1.1",
    newer: true,
    url: "https://github.com/Eward-Nee/pulse-gym/releases/tag/v0.1.1",
    notes: "",
    apk: {
      url: "https://example.invalid/test.apk",
      digest: "sha256:" + createHash("sha256").update(env.apk).digest("hex"),
    },
  };
  await assert.rejects(
    app.installRelease({ ...release, newer: false }),
    /No newer/,
  );
  assert.equal(env.installs.length, 0);
  await app.installRelease(release);
  assert.equal(env.installs.length, 1);
  assert.equal(
    env.installs[0].o.type,
    "application/vnd.android.package-archive",
  );
  await assert.rejects(
    app.installRelease({
      ...release,
      apk: { ...release.apk, digest: "sha256:" + "0".repeat(64) },
    }),
  );
  assert.equal(env.installs.length, 1);
  assert.equal(env.deleted, true);
  sqlite.close();
});

test("GitHub release discovery: newer APK, required digest, wrong origin, missing release and fixed repo", async () => {
  const { app, env, sqlite } = await device("192.168.1.10");
  const base = "https://github.com/Eward-Nee/pulse-gym/releases/";
  let data: any = {
    tag_name: "v0.1.1",
    html_url: base + "tag/v0.1.1",
    body: "Fixes",
    assets: [
      {
        name: "pulse.apk",
        size: 1000,
        digest: "sha256:" + "a".repeat(64),
        browser_download_url: base + "download/v0.1.1/pulse.apk",
      },
    ],
  };
  env.fetch = async (url: string, options: any) => {
    assert.equal(
      url,
      "https://api.github.com/repos/Eward-Nee/pulse-gym/releases/latest",
    );
    assert.ok(options.signal);
    return { ok: true, json: async () => data };
  };
  // Old v0.1.0 settings must never redirect the fixed update source.
  await app.updateSettings({ repo: "someone/else" });
  const release = await app.checkRelease();
  assert.equal(release.newer, true);
  assert.equal(release.apk.name, "pulse.apk");
  data.assets[0].digest = null;
  assert.equal((await app.checkRelease()).apk, undefined);
  data.html_url = "https://untrusted.invalid/release";
  await assert.rejects(app.checkRelease(), /release address/);
  env.fetch = async () => ({ ok: false, status: 404 });
  await assert.rejects(app.checkRelease(), /No public release/);

  sqlite.close();
});

test("queued settings patches preserve name when theme is changed immediately afterwards", async () => {
  const { app, sqlite } = await device("192.168.1.10");
  await Promise.all([
    app.serial(() => app.updateSettings({ name: "QA name" })),
    app.serial(() => app.updateSettings({ theme: "couples" })),
  ]);
  const s = await app.snapshot();
  assert.equal(s.settings.name, "QA name");
  assert.equal(s.settings.theme, "couples");
  sqlite.close();
});
const workout = (name: string) => ({
  id: randomUUID(),
  name,
  position: 0,
  notes: "",
  exercises: [
    {
      id: randomUUID(),
      name: "Squat",
      kind: "strength",
      sets: 3,
      reps: 5,
      kg: 20,
      seconds: 0,
      meters: 0,
      rest: 60,
      notes: "",
    },
  ],
});
test("active workouts can be saved, resumed and cancelled without touching history", async () => {
  const { app, sqlite } = await device("192.168.1.10");
  const w = (await app.snapshot()).workouts[0];
  const session = { workout: w, startedAt: 1000, completedSets: { a: 1 } };
  await app.saveActiveSession(session);
  assert.deepEqual((await app.load()).active, session);
  await app.storeSession({
    id: randomUUID(),
    name: "Earlier",
    finishedAt: 5,
    seconds: 60,
    exercises: w.exercises,
    completedSets: {},
  });
  await app.clearActiveSession();
  const after = await app.load();
  assert.equal(after.active, null);
  assert.equal(after.data.sessions.length, 1);
  assert.equal(after.data.workouts.length, 2);
  await app.clearActiveSession(); // cancelling twice is harmless
  sqlite.close();
});
test("workout positions stay unique after deleting and adding", async () => {
  const { app, sqlite } = await device("192.168.1.10");
  const [a, b, c] = [workout("A"), workout("B"), workout("C")];
  for (const w of [a, b, c]) await app.putWorkout(w);
  let ids = (await app.snapshot()).workouts.map((w: any) => w.id);
  assert.deepEqual(ids.slice(2), [a.id, b.id, c.id]);
  await app.deleteWorkout(ids[0]);
  await app.putWorkout(workout("D"));
  const s = await app.snapshot();
  assert.deepEqual(
    s.workouts.map((w: any) => w.position),
    [0, 1, 2, 3, 4],
  );
  assert.equal(s.workouts.at(-1).name, "D");
  // editing an existing workout never moves it
  await app.putWorkout({ ...a, name: "A2", position: 99 });
  const again = (await app.snapshot()).workouts;
  assert.equal(again.find((w: any) => w.id === a.id).position, 1);
  sqlite.close();
});
test("reads queue behind transactions: a rolled-back write is never visible", async () => {
  const { app, env, sqlite } = await device("192.168.1.10");
  const ghost = workout("Ghost");
  const slow = app
    .serial(async () => {
      await env.db.withTransactionAsync(async () => {
        await app.putWorkout(ghost);
        await new Promise((r) => setTimeout(r, 20));
        throw new Error("boom");
      });
    })
    .catch(() => {});
  const seen = app.load(); // requested while the transaction is open
  await slow;
  const { data } = await seen;
  assert.ok(!data.workouts.some((w: any) => w.id === ghost.id));
  assert.equal(data.workouts.length, 2);
  sqlite.close();
});
test("startup is atomic and repeatable, and tolerates unreadable stored JSON", async () => {
  const { app, env, sqlite } = await device("192.168.1.10");
  await Promise.all([app.initDB(), app.initDB()]);
  assert.equal((await app.snapshot()).workouts.length, 2);
  assert.equal(
    (await env.db.getFirstAsync("SELECT count(*) n FROM profile")).n,
    1,
  );
  assert.equal(
    (await env.db.getFirstAsync("PRAGMA user_version")).user_version,
    1,
  );
  await env.db.runAsync("UPDATE profile SET settings='{broken'");
  await env.db.runAsync(
    "UPDATE workouts SET exercises='nope' WHERE position=0",
  );
  const s = await app.snapshot();
  assert.equal(s.settings.name, "Athlete");
  assert.equal(s.settings.language, "en");
  assert.deepEqual(s.workouts[0].exercises, []);
  sqlite.close();
});
test("language preference defaults to English, persists, and rejects unknown values", async () => {
  const { app, sqlite } = await device("192.168.1.10");
  assert.equal((await app.snapshot()).settings.language, "en");
  await app.updateSettings({ language: "af" });
  assert.equal((await app.snapshot()).settings.language, "af");
  await app.updateSettings({ theme: "couples" });
  assert.equal((await app.snapshot()).settings.language, "af");
  await app.updateSettings({ language: "xx" });
  assert.equal((await app.snapshot()).settings.language, "en");
  sqlite.close();
});
