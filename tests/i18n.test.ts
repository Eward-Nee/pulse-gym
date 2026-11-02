import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { af } from "../src/i18n/af";
import { setLanguage, t, tn, locale } from "../src/i18n";
import {
  DURATIONS,
  EXERCISE_LABELS,
  DEFAULT_SETTINGS,
} from "../src/core/model";
import { PHASES, STATIONS, generateWeek } from "../src/core/hyrox";

function sources(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory()
      ? e.name === "i18n"
        ? []
        : sources(p)
      : /\.tsx?$/.test(e.name)
        ? [p]
        : [];
  });
}
/** String literals passed to t(...) (first argument) and tn(...) (all literal arguments). */
function usedKeys() {
  const keys = new Set<string>();
  for (const file of [...sources("src"), "App.tsx"]) {
    const text = fs.readFileSync(file, "utf8");
    for (const m of text.matchAll(/(?<![\w.])(tn|t)\(/g)) {
      let depth = 1,
        i = m.index! + m[0].length,
        first = true;
      while (i < text.length && depth) {
        const ch = text[i];
        if (ch === '"') {
          let j = i + 1;
          while (text[j] !== '"') j += text[j] === "\\" ? 2 : 1;
          const literal = JSON.parse(text.slice(i, j + 1));
          if (m[1] === "tn" || (first && depth === 1)) keys.add(literal);
          i = j;
        } else if (ch === "(") depth++;
        else if (ch === ")") depth--;
        if (ch !== " " && ch !== "\n" && ch !== '"') first = false;
        if (ch === '"') first = false;
        i++;
      }
    }
  }
  return keys;
}
// Keys that reach t() through variables rather than literals.
const dynamic = [
  ...Object.values(EXERCISE_LABELS),
  ...DURATIONS.map((d) => d.label),
  ...PHASES,
  // loads like "20 kg" are language-neutral and intentionally untranslated
  ...STATIONS.map((s) => s[2]).filter((l) =>
    /[a-z]{3}/i.test(l.replace(/kg/g, "")),
  ),
  "Home",
  "Challenge",
  "Setup",
  "Browser preview · no direct sockets",
  "Preparing connection…",
  "Browser preview · use the native build to connect",
  "Direct connection needs a native build, not Expo Go.",
  "Connection error: {message}",
  "Listening for direct connections · keep both apps open",
  "{message}",
];
const placeholders = (s: string) =>
  [...s.matchAll(/\{\w+\}/g)].map((m) => m[0]).sort();
test("English is the default language", () => {
  assert.equal(DEFAULT_SETTINGS.language, "en");
  setLanguage("en");
  assert.equal(t("Start"), "Start");
  assert.equal(locale(), "en-ZA");
});
test("every string passed to t() has an Afrikaans translation with matching placeholders", () => {
  const keys = new Set([...usedKeys(), ...dynamic]);
  assert.ok(keys.size > 300, "scanner found the app's strings: " + keys.size);
  const missing = [...keys].filter((k) => !(k in af));
  assert.deepEqual(missing, []);
  for (const k of keys)
    assert.deepEqual(placeholders(af[k]), placeholders(k), k);
});
test("Afrikaans keeps working and unknown strings fall back to English", () => {
  setLanguage("af");
  try {
    assert.equal(t("Close"), "Sluit");
    assert.equal(t("Hide ID"), "Versteek ID");
    assert.equal(t("Hey, {name}.", { name: "Ané" }), "Haai, Ané.");
    assert.equal(t("not translated {x}", { x: 1 }), "not translated 1");
    assert.equal(tn(1, "{n} set", "{n} sets"), "1 stel");
    assert.equal(tn(3, "{n} set", "{n} sets"), "3 stelle");
    assert.equal(locale(), "af-ZA");
    // generated plans follow the active language
    const week = generateWeek(
      { level: "foundation", trainingDays: 3 },
      1,
      () => "x",
    );
    assert.match(week[0].name, /Ma · Krag/);
  } finally {
    setLanguage("en");
  }
  assert.match(
    generateWeek({ level: "foundation", trainingDays: 3 }, 1, () => "x")[0]
      .name,
    /Mon · Strength/,
  );
  assert.equal(tn(1, "{n} set", "{n} sets"), "1 set");
});
