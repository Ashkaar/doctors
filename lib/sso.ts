import "server-only";
import { createHmac, timingSafeEqual } from "crypto";

// Arriving from Ariloo already signed in. When a clinic's owner presses
// "Open Doctors" in their Ariloo account, Ariloo sends them to
// /<clinic>/api/auth/sso?token=v1.<clinic>.<expires>.<hmac>, where hmac is
// HMAC-SHA256 hex of "sso:<clinic>.<expires>" with DOCTORS_SSO_SECRET (the
// same value in both apps). It is good for one minute and only for the
// clinic it names.
//
// `expires` may be in milliseconds or in seconds since 1970 (Ariloo's
// Restafe and Dukaloo links use seconds): a value above 10^11 is read as
// milliseconds. The signature always covers the digits exactly as sent.

export const SSO_MAX_SECONDS = 60;

export function signSsoToken(slug: string, expires: number, secret: string): string {
  return `v1.${slug}.${expires}.${createHmac("sha256", secret).update(`sso:${slug}.${expires}`).digest("hex")}`;
}

export function checkSsoToken(token: string | null, slug: string, secret = process.env.DOCTORS_SSO_SECRET, nowMs = Date.now()): boolean {
  if (!secret || !token) return false;
  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== "v1" || parts[1] !== slug || !/^\d{1,15}$/.test(parts[2]) || !/^[0-9a-f]{64}$/.test(parts[3])) return false;
  const raw = Number(parts[2]);
  const expiresMs = raw > 1e11 ? raw : raw * 1000;
  // Not expired, and not issued for longer than a minute (a few seconds of
  // clock difference between the two servers are allowed).
  if (!(expiresMs > nowMs) || expiresMs > nowMs + (SSO_MAX_SECONDS + 5) * 1000) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(`sso:${slug}.${parts[2]}`).digest("hex"));
  const actual = Buffer.from(parts[3]);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
