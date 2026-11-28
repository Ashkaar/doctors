import "server-only";
import { randomBytes } from "crypto";
import { eq, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { normaliseHours, normalisePrint, type HoursSettings, type PrintSettings } from "./clinicSettings";
import { normaliseTypes, type ClinicType } from "./specialties";
import { getDb } from "./db";
import { clinicSettings } from "./db/schema";
import { dayOf } from "./format";
import { effectiveTimeZone, normaliseSetting, TZ_COOKIE, type TimeZoneSetting } from "./timeZone";
import { logError } from "./safeLog";

// Clinic settings: one JSON value per key in clinic_settings, normalised
// with defaults when read, so older or missing values keep working.

async function readSetting(key: string): Promise<unknown> {
  const db = await getDb();
  const [row] = await db.select().from(clinicSettings).where(eq(clinicSettings.key, key));
  if (!row) return undefined;
  try {
    return JSON.parse(row.value);
  } catch {
    return undefined;
  }
}

async function writeSetting(key: string, value: unknown): Promise<void> {
  const db = await getDb();
  await db
    .insert(clinicSettings)
    .values({ key, value: JSON.stringify(value) })
    .onConflictDoUpdate({ target: clinicSettings.key, set: { value: sql`excluded.value` } });
}

export async function getTimeZoneSetting(): Promise<TimeZoneSetting> {
  return normaliseSetting(await readSetting("time_zone"));
}

export async function setTimeZoneSetting(value: TimeZoneSetting): Promise<void> {
  await writeSetting("time_zone", normaliseSetting(value));
}

// The zone for this request: the clinic's choice, or this device's.
export async function requestTimeZone(): Promise<{ setting: TimeZoneSetting; timeZone: string }> {
  let setting: TimeZoneSetting = "device";
  try {
    setting = await getTimeZoneSetting();
  } catch (err) {
    logError("read the time zone setting", err);
  }
  const device = (await cookies()).get(TZ_COOKIE)?.value;
  return { setting, timeZone: effectiveTimeZone(setting, device) };
}

// Today's date in this request's time zone, with the zone.
export async function requestToday(): Promise<{ day: string; timeZone: string }> {
  const { timeZone } = await requestTimeZone();
  return { day: dayOf(Date.now(), timeZone), timeZone };
}

export async function getPrintSettings(): Promise<PrintSettings> {
  return normalisePrint(await readSetting("print"));
}

export async function setPrintSettings(value: PrintSettings): Promise<void> {
  await writeSetting("print", normalisePrint(value));
}

export async function getHours(): Promise<HoursSettings> {
  return normaliseHours(await readSetting("hours"));
}

export async function setHours(value: HoursSettings): Promise<void> {
  await writeSetting("hours", normaliseHours(value));
}

// The waiting-room screen's key: part of its address, so only a device
// given the link can show the queue numbers. A new key stops old links.
export async function getScreenKey(): Promise<string | null> {
  const v = await readSetting("screen_key");
  return typeof v === "string" && /^[a-f0-9]{32}$/.test(v) ? v : null;
}

export async function newScreenKey(): Promise<string> {
  const key = randomBytes(16).toString("hex");
  await writeSetting("screen_key", key);
  return key;
}

// What kind of clinic this is (null until the owner has chosen).
export async function getClinicTypes(): Promise<ClinicType[] | null> {
  return normaliseTypes(await readSetting("clinic_types"));
}

export async function setClinicTypes(types: ClinicType[]): Promise<void> {
  await writeSetting("clinic_types", types);
}
