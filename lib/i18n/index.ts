import ar from "./ar";
import en, { type Messages } from "./en";
import ku from "./ku";
import tr from "./tr";

// The languages the app speaks. Adding text anywhere means adding it to
// en.ts and to every other dictionary; their `Messages` type makes a
// missing key a type error.

export type { Messages };

export const LANGUAGES = {
  en: { label: "English", dir: "ltr", intl: "en-GB", html: "en" },
  ku: { label: "کوردی", dir: "rtl", intl: "ckb-IQ", html: "ckb" },
  ar: { label: "العربية", dir: "rtl", intl: "ar-IQ", html: "ar" },
  tr: { label: "Türkçe", dir: "ltr", intl: "tr-TR", html: "tr" },
} as const;

export type Lang = keyof typeof LANGUAGES;
export type Dir = "ltr" | "rtl";

export const LANG_CODES = Object.keys(LANGUAGES) as Lang[];
export const DEFAULT_LANG: Lang = "en";
// Chosen per device, remembered for a year, read on the server so the first
// render is already in the right language and direction.
export const LANG_COOKIE = "doctors_lang";

export const MESSAGES: Record<Lang, Messages> = { en, ku, ar, tr };

export function isLang(value: unknown): value is Lang {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(LANGUAGES, value);
}

// Locale for Intl number and date formatting. Western digits everywhere,
// so amounts look like what the cashier types and the scanner reads.
export function intlLocale(lang: Lang): string {
  return `${LANGUAGES[lang].intl}-u-nu-latn`;
}

// Every text: [key, English text] (for tests).
export function textKeys(messages: Messages = en): [string, string][] {
  const out: [string, string][] = [];
  const walk = (node: unknown, path: string) => {
    if (typeof node === "string") out.push([path, node]);
    else if (node && typeof node === "object") for (const [k, v] of Object.entries(node)) walk(v, path ? `${path}.${k}` : k);
  };
  walk(messages, "");
  return out;
}
