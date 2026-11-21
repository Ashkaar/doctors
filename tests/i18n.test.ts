import { describe, expect, it } from "vitest";
import { LANG_CODES, MESSAGES, textKeys } from "@/lib/i18n";

describe("dictionaries", () => {
  it("have the same keys and kinds in every language", () => {
    const shape = (node: unknown): unknown =>
      node && typeof node === "object" ? Object.fromEntries(Object.entries(node).map(([k, v]) => [k, shape(v)])) : typeof node;
    for (const lang of LANG_CODES) expect(shape(MESSAGES[lang])).toEqual(shape(MESSAGES.en));
  });
  it("have no empty texts", () => {
    for (const lang of LANG_CODES) for (const [key, value] of textKeys(MESSAGES[lang])) expect(value.trim(), `${lang}:${key}`).not.toBe("");
  });
  it("keep Ariloo in Latin letters", () => {
    for (const lang of LANG_CODES) expect(MESSAGES[lang].notice.account).toContain("Ariloo");
  });
});
