import { describe, expect, it } from "vitest";
import { checkSsoToken, signSsoToken } from "@/lib/sso";

const secret = "test-secret";
const now = 1_800_000_000_000;
const inSeconds = (s: number) => Math.floor(now / 1000) + s;

describe("checkSsoToken", () => {
  it("accepts a fresh token for the same clinic", () => {
    expect(checkSsoToken(signSsoToken("city-clinic", inSeconds(60), secret), "city-clinic", secret, now)).toBe(true);
  });
  it("matches Ariloo's format: HMAC-SHA256 hex of sso:<shop>.<expires>", async () => {
    const { createHmac } = await import("crypto");
    const expires = inSeconds(30);
    const token = `v1.city-clinic.${expires}.${createHmac("sha256", secret).update(`sso:city-clinic.${expires}`).digest("hex")}`;
    expect(checkSsoToken(token, "city-clinic", secret, now)).toBe(true);
  });
  it("refuses another clinic", () => {
    expect(checkSsoToken(signSsoToken("city-clinic", inSeconds(60), secret), "other-clinic", secret, now)).toBe(false);
  });
  it("refuses an expired token", () => {
    expect(checkSsoToken(signSsoToken("city-clinic", inSeconds(-1), secret), "city-clinic", secret, now)).toBe(false);
  });
  it("refuses a token valid for much longer than a minute", () => {
    expect(checkSsoToken(signSsoToken("city-clinic", inSeconds(600), secret), "city-clinic", secret, now)).toBe(false);
  });
  it("refuses a wrong signature, a wrong secret and junk", () => {
    const good = signSsoToken("city-clinic", inSeconds(60), secret);
    expect(checkSsoToken(`${good.slice(0, -1)}0`.replace(/00$/, "01"), "city-clinic", secret, now)).toBe(false);
    expect(checkSsoToken(good, "city-clinic", "other", now)).toBe(false);
    expect(checkSsoToken("v1.city-clinic.abc.def", "city-clinic", secret, now)).toBe(false);
    expect(checkSsoToken(null, "city-clinic", secret, now)).toBe(false);
    expect(checkSsoToken(good, "city-clinic", "", now)).toBe(false);
  });
});

describe("checkSsoToken with milliseconds", () => {
  const inMs = (s: number) => now + s * 1000;
  it("accepts expires given in milliseconds", () => {
    expect(checkSsoToken(signSsoToken("city-clinic", inMs(60), secret), "city-clinic", secret, now)).toBe(true);
  });
  it("refuses an expired or too-long millisecond token", () => {
    expect(checkSsoToken(signSsoToken("city-clinic", inMs(-1), secret), "city-clinic", secret, now)).toBe(false);
    expect(checkSsoToken(signSsoToken("city-clinic", inMs(600), secret), "city-clinic", secret, now)).toBe(false);
  });
});
