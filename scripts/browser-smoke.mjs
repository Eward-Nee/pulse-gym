import fs from "node:fs";
const tabs = await (await fetch("http://127.0.0.1:9444/json/list")).json();
const target =
  tabs.find((t) => t.url === "about:blank") ||
  tabs.find((t) => t.url.includes(":8766"));
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
let sequence = 0;
const pending = new Map(),
  errors = [];
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id) {
    const p = pending.get(m.id);
    pending.delete(m.id);
    m.error ? p.reject(m.error) : p.resolve(m.result);
  }
  if (m.method === "Runtime.exceptionThrown")
    errors.push(
      m.params.exceptionDetails.exception?.description ||
        m.params.exceptionDetails.text,
    );
});
const call = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
await call("Runtime.enable");
await call("Page.enable");
await call("Emulation.setDeviceMetricsOverride", {
  width: 430,
  height: 932,
  deviceScaleFactor: 1,
  mobile: false,
});
await call("Page.navigate", { url: "http://127.0.0.1:8766" });
await new Promise((r) => setTimeout(r, 3000));
const run = async (expression) => {
  const r = await call("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (r.exceptionDetails)
    throw Error(
      r.exceptionDetails.exception?.description || r.exceptionDetails.text,
    );
  return r.result.value;
};
console.log("BOOT", await run("document.body.innerText.slice(0,1200)"));
fs.writeFileSync(
  "scripts/first-render.png",
  Buffer.from(
    (await call("Page.captureScreenshot", { format: "png" })).data,
    "base64",
  ),
);
if (!(await run('document.body.innerText.includes("Jou workouts")')))
  throw Error("App did not boot");
const click = async (label) => {
  await run(
    `(()=>{const e=[...document.querySelectorAll('[role="button"],[role="tab"]')].find(e=>e.textContent.trim().endsWith(${JSON.stringify(label)}));if(!e)throw Error('Missing control '+${JSON.stringify(label)});e.click();})()`,
  );
  await new Promise((r) => setTimeout(r, 180));
};
const fill = async (label, value) => {
  await run(
    `(()=>{const e=document.querySelector('input[aria-label="${label}"],textarea[aria-label="${label}"]');if(!e)throw Error('Missing field');const p=e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`,
  );
  await new Promise((r) => setTimeout(r, 120));
};
await click("Setup");
await click("♥ Couples");
await new Promise((r) => setTimeout(r, 300));
if (!(await run('document.body.innerText.includes("TOGETHER")')))
  throw Error("Theme failed");
await fill("Jou naam", "Pulse tester");
await click("Stoor naam");
await click("Home");
await click("Nuut");
await fill("Workout-naam", "Browser persistence check");
await click("Voeg oefening by");
await fill("Oefening", "Test squat");
await click("Stoor workout");
await new Promise((r) => setTimeout(r, 350));
if (
  !(await run('document.body.innerText.includes("Browser persistence check")'))
)
  throw Error("Workout save failed");
await call("Page.reload");
await new Promise((r) => setTimeout(r, 1500));
if (
  !(await run(
    'document.body.innerText.includes("Browser persistence check")&&document.body.innerText.includes("Hey, Pulse.")&&document.body.innerText.includes("TOGETHER")',
  ))
)
  throw Error("SQLite persistence failed");
console.log("PASS theme, profile, workout and reload persistence");
await click("Setup");
await click("Stel datum & program");
await fill("Wedrendatum (JJJJ-MM-DD)", "2027-08-14");
await click("Stoor wedreninstellings");
await click("W12");
await click("Voeg week 12 se 3 workouts by");
await new Promise((r) => setTimeout(r, 300));
await click("Sluit");
await click("Home");
if (!(await run('document.body.innerText.includes("HYROX W12")')))
  throw Error("HYROX import failed");
console.log("PASS date and week import");
await click("Begin jou volgende sessie");
await click("Stel klaar");
await click("Sluit");
await click("Hervat aktiewe workout");
if (!(await run('document.body.innerText.includes("1 / 3")')))
  throw Error("Session close/reopen lost set count");
await call("Page.reload");
await new Promise((r) => setTimeout(r, 1500));
await click("Hervat aktiewe workout");
if (!(await run('document.body.innerText.includes("1 / 3")')))
  throw Error("Session reload lost set count");
await click("Stoor gedeeltelike sessie");
await click("Geskiedenis");
if (!(await run('document.body.innerText.includes("1 stelle")')))
  throw Error("History did not preserve completed sets");
await click("Sluit");
console.log(
  "PASS set completion, immediate resume, full reload resume and partial-session history",
);

await click("Challenge");
await click("Nuwe challenge");
if (!(await run('document.body.innerText.includes("Koppel eers")')))
  throw Error("Missing empty friend guard");
await click("Sluit");
await click("Home");
console.log(
  "LAYOUT",
  await run("({width:innerWidth,scroll:document.documentElement.scrollWidth})"),
);
console.log("ERRORS", errors);
fs.writeFileSync(
  "scripts/couples-render.png",
  Buffer.from(
    (await call("Page.captureScreenshot", { format: "png" })).data,
    "base64",
  ),
);
ws.close();
