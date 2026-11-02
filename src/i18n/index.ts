import { af } from "./af";
export type Language = "en" | "af";
export const LANGUAGES: { code: Language; label: string }[] = [
  { code: "en", label: "English" },
  { code: "af", label: "Afrikaans" },
];
export const DEFAULT_LANGUAGE: Language = "en";
let current: Language = DEFAULT_LANGUAGE;
export const isLanguage = (v: unknown): v is Language =>
  v === "en" || v === "af";
export function setLanguage(language: Language) {
  current = isLanguage(language) ? language : DEFAULT_LANGUAGE;
}
export const getLanguage = () => current;
export const locale = () => (current === "af" ? "af-ZA" : "en-ZA");
/** English text is the key; Afrikaans is looked up, anything missing falls back to English. */
export function t(text: string, vars?: Record<string, string | number>) {
  const out = current === "af" ? (af[text] ?? text) : text;
  return vars
    ? out.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m))
    : out;
}
/** Pick the singular or plural English key by count; `{n}` is filled in. */
export const tn = (n: number, one: string, other: string) =>
  t(n === 1 ? one : other, { n });
