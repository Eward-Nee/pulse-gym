import fs from "node:fs";
const tabs = await (await fetch("http://127.0.0.1:9444/json/list")).json();
const target =
  tabs.find((t) => t.url === "about:blank") ||
  tabs.find((t) => t.url.includes(":8766"));
const SHOTS = process.env.SHOTS || "scripts";
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
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (name) =>
  fs.writeFileSync(
    `${SHOTS}/${name}.png`,
    Buffer.from(
      (await call("Page.captureScreenshot", { format: "png" })).data,
      "base64",
    ),
  );
const has = (text) =>
  run(`document.body.innerText.includes(${JSON.stringify(text)})`);
const expect = async (text, message) => {
  if (!(await has(text))) throw Error(message + ` (missing "${text}")`);
};
const gone = async (text, message) => {
  if (await has(text)) throw Error(message + ` (still shows "${text}")`);
};
const click = async (label, last = false) => {
  await run(
    `(()=>{const all=[...document.querySelectorAll('[role="button"],[role="tab"]')].filter(e=>e.textContent.trim().endsWith(${JSON.stringify(label)}));const e=all[${last ? "all.length-1" : "0"}];if(!e)throw Error('Missing control '+${JSON.stringify(label)});e.click();})()`,
  );
  await wait(250);
};
const fill = async (label, value) => {
  await run(
    `(()=>{const e=document.querySelector('input[aria-label="${label}"],textarea[aria-label="${label}"]');if(!e)throw Error('Missing field '+${JSON.stringify(label)});const p=e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`,
  );
  await wait(120);
};
await expect("Your workouts", "App did not boot in English by default");
await shot("01-home-default-english");
console.log("PASS boots in English by default");

// Screen transition: right after a tab press the new screen is mid-slide.
await run(
  `(()=>{[...document.querySelectorAll('[role="tab"]')].find(e=>e.textContent.trim().endsWith('Setup')).click()})()`,
);
await wait(60);
const sliding = await run(
  `[...document.querySelectorAll('div')].some(e=>{const t=getComputedStyle(e).transform;if(!t||t==='none')return false;const m=t.match(/matrix\\(([^)]+)\\)/);return m&&Math.abs(parseFloat(m[1].split(',')[4]))>1&&getComputedStyle(e).flexGrow==='1'})`,
);
await wait(400);
if (!sliding) throw Error("No slide transition detected on tab change");
console.log("PASS tab change animates");

// The floating tab bar: transparent container, and its pill glides between tabs.
const barBackground = await run(
  `(()=>{const tab=document.querySelector('[role="tab"]');const container=tab.parentElement.parentElement;return getComputedStyle(container).backgroundColor+'|'+getComputedStyle(container).position})()`,
);
if (!/^rgba\(0, 0, 0, 0\)\|absolute$/.test(barBackground))
  throw Error(
    "Tab bar container is not a transparent overlay: " + barBackground,
  );
const pillX = () =>
  run(
    `document.querySelector('[role="tab"]').parentElement.firstElementChild.getBoundingClientRect().left`,
  );
const startX = await pillX();
await run(
  `[...document.querySelectorAll('[role="tab"]')].find(e=>e.textContent.trim().endsWith('Home')).click()`,
);
await wait(70);
const midX = await pillX();
await wait(900);
const endX = await pillX();
if (!(endX < startX - 40 && midX < startX - 1 && midX > endX + 1))
  throw Error(`Tab pill did not glide: ${startX} -> ${midX} -> ${endX}`);
console.log(
  "PASS tab bar is transparent and the pill glides",
  startX,
  midX,
  endX,
);
await click("Setup");
await wait(500);

// No visible scrollbars on any scroll container.
const bars = await run(
  `[...document.querySelectorAll('*')].filter(e=>{const s=getComputedStyle(e);return /(auto|scroll)/.test(s.overflowY)&&e.scrollHeight>e.clientHeight+1&&s.scrollbarWidth!=='none'}).length`,
);
if (bars) throw Error(bars + " scroll containers still show a scrollbar");
console.log("PASS no scrollbars");

// Wallpapers: all three previews exist and the picker changes the Home hero.
await shot("02-setup-wallpapers");
for (const w of [
  "Steel / cool",
  "Together / rose",
  "Calm / solid",
  "Iron / warm",
]) {
  await click(w);
  await shot("03-wallpaper-" + w.split(" ")[0].toLowerCase());
}
console.log("PASS wallpaper picker");

// ID toggle.
await click("Show my ID");
await wait(300);
await expect("Hide ID", "ID button did not become Hide ID");
await click("Hide ID");
await expect("Show my ID", "ID button did not revert");
console.log("PASS show / hide ID");

// Language.
await click("Afrikaans");
await wait(300);
await expect("Jou naam", "Afrikaans not applied");
await shot("04-setup-afrikaans");
await click("English");
await wait(300);
await expect("Your name", "English not restored");
console.log("PASS language switch");

await click("♥ Couples");
await wait(300);
await expect("TOGETHER", "Theme failed");
await fill("Your name", "Pulse tester");
await click("Save name");
await click("Home");
await click("New");
await fill("Workout name", "Browser persistence check");
await click("Add exercise");
await fill("Exercise", "Test squat");
await shot("05-builder");
await click("Time");
await wait(200);
await expect("Weight (kg)", "Time exercises must have a weight field");
await gone(
  "Distance (meters)",
  "Time exercises must not have a distance field",
);
await shot("05b-builder-time");
await click("Run / distance");
await wait(200);
await expect("Distance (meters)", "Run exercises keep their distance field");
await gone("Weight (kg)", "Run exercises must not have a weight field");
await click("Weight");
await wait(200);
await run(
  `(()=>{const m=document.querySelector('[role="dialog"],div[aria-modal="true"]');(m||document.body).scrollTo?.(0,400)})()`,
);
const overlap = await run(
  `(()=>{const f=[...document.querySelectorAll('input')].filter(i=>['Sets','Reps per set','Weight (kg)','Rest (seconds)','Exercise notes'].includes(i.getAttribute('aria-label'))).map(i=>{const r=i.getBoundingClientRect();return[i.getAttribute('aria-label'),r.left,r.top,r.right,r.bottom]});const bad=[];for(let a=0;a<f.length;a++)for(let b=a+1;b<f.length;b++){if(f[a][1]<f[b][3]&&f[b][1]<f[a][3]&&f[a][2]<f[b][4]&&f[b][2]<f[a][4])bad.push(f[a][0]+'/'+f[b][0])}return{count:f.length,bad}})()`,
);
if (overlap.count < 5 || overlap.bad.length)
  throw Error("Builder fields overlap: " + JSON.stringify(overlap));
console.log("PASS builder fields do not overlap", JSON.stringify(overlap));
await click("Save workout");
await wait(350);
await expect("Browser persistence check", "Workout save failed");
await call("Page.reload");
await wait(1500);
await expect("Browser persistence check", "SQLite persistence failed");
await expect("Hey, Pulse.", "Profile did not persist");
await expect("TOGETHER", "Theme did not persist");
console.log("PASS theme, profile, workout and reload persistence");

await click("Setup");
await click("Set date & program");
await fill("Race date (YYYY-MM-DD)", "2027-08-14");
await click("Save race settings");
await click("W12");
await click("Add week 12’s 3 workouts");
await wait(300);
await click("Close");
await click("Home");
await expect("HYROX W12", "HYROX import failed");
console.log("PASS date and week import");

await click("Start your next session");
await click("Set done");
await click("Close");
await click("Resume active workout");
await expect("1 / 3", "Session close/reopen lost set count");
await call("Page.reload");
await wait(1500);
await click("Resume active workout");
await expect("1 / 3", "Session reload lost set count");
await shot("06-session");
await click("Save partial session");
await click("History");
await expect("1 set", "History did not preserve completed sets");
await click("Close");
console.log(
  "PASS set completion, immediate resume, full reload resume and partial-session history",
);

// Cancel from the session screen, then from Home.
await click("Start your next session");
await click("Set done");
await click("Cancel workout", true);
await expect("Cancel this workout?", "No cancel confirmation in session");
await click("Keep training");
await expect("Your session", "Keep training closed the session");
await click("Cancel workout", true);
await click("Yes, cancel workout");
await wait(400);
await gone("Your session", "Session still open after cancel");
await gone("Resume active workout", "Active workout survived cancel (session)");
await call("Page.reload");
await wait(1500);
await gone("Resume active workout", "Cancelled workout came back after reload");
await click("Start your next session");
await click("Close");
await expect("Resume active workout", "Active workout card missing");
await click("Cancel workout");
await expect("Cancel this workout?", "No cancel confirmation on Home");
await click("Yes, cancel workout");
await wait(400);
await gone("Resume active workout", "Active workout survived cancel (Home)");
await click("History");
await expect("1 set", "Cancel must not touch history");
await click("Close");
console.log("PASS cancel active workout (session and Home), history untouched");

await click("Challenge");
await click("New challenge");
await expect("Connect a friend first", "Missing empty friend guard");
await click("Close");
await click("Home");
console.log(
  "LAYOUT",
  await run("({width:innerWidth,scroll:document.documentElement.scrollWidth})"),
);
console.log("ERRORS", errors);
await shot("07-couples-home");
ws.close();
