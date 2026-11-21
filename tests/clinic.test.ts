import { describe, expect, it } from "vitest";
import { ageOn, chargeSchema, minutesToTime, parseVitals, patientSchema, timeToMinutes } from "@/lib/clinic";
import { normaliseHours, normalisePrint } from "@/lib/clinicSettings";
import { CLINICAL_OF, OWNER_SECTIONS, ROLE_SECTIONS, STAFF_SECTIONS } from "@/lib/sections";

describe("patients", () => {
  it("works out age from a full date or a year", () => {
    expect(ageOn("1990-11-22", "2026-11-21")).toBe(35);
    expect(ageOn("1990-11-21", "2026-11-21")).toBe(36);
    expect(ageOn("1990", "2026-11-21")).toBe(36);
    expect(ageOn("", "2026-11-21")).toBeNull();
    expect(ageOn("2030-01-01", "2026-11-21")).toBeNull();
  });
  it("accepts only known genders, blood groups and date shapes", () => {
    expect(patientSchema.safeParse({ name: "Sara", gender: "x" }).success).toBe(false);
    expect(patientSchema.safeParse({ name: "Sara", bloodGroup: "Z+" }).success).toBe(false);
    expect(patientSchema.safeParse({ name: "Sara", birthDate: "1990-1-1" }).success).toBe(false);
    expect(patientSchema.safeParse({ name: "  " }).success).toBe(false);
    expect(patientSchema.parse({ name: " Sara ", birthDate: "1990" })).toMatchObject({ name: "Sara", birthDate: "1990", phone: "" });
  });
});

describe("times", () => {
  it("turns minutes into HH:MM and back", () => {
    expect(minutesToTime(570)).toBe("09:30");
    expect(timeToMinutes("09:30")).toBe(570);
    expect(timeToMinutes("9:05")).toBe(545);
    expect(timeToMinutes("24:00")).toBeNull();
    expect(timeToMinutes("ab")).toBeNull();
  });
  it("keeps booking hours sensible", () => {
    expect(normaliseHours(undefined)).toEqual({ startMin: 540, endMin: 1260 });
    expect(normaliseHours({ startMin: 600, endMin: 500 }).endMin).toBeGreaterThan(600);
  });
});

describe("visits", () => {
  it("reads only known whole-number vitals", () => {
    expect(parseVitals('{"bpSys":120,"bpDia":80,"tempC10":375}')).toEqual({ bpSys: 120, bpDia: 80, tempC10: 375 });
    expect(parseVitals('{"bpSys":120.5}')).toEqual({});
    expect(parseVitals('{"other":1}')).toEqual({});
    expect(parseVitals("not json")).toEqual({});
  });
  it("prints on A5 unless A4 is chosen", () => {
    expect(normalisePrint(undefined).paper).toBe("a5");
    expect(normalisePrint({ paper: "a4", header: "x".repeat(500) })).toMatchObject({ paper: "a4" });
    expect(normalisePrint({ header: "x".repeat(500) }).header).toHaveLength(300);
  });
});

describe("fees", () => {
  it("refuses a discount bigger than the fee and non-integer money", () => {
    expect(chargeSchema.safeParse({ patientId: 1, amount: 1000, discount: 2000 }).success).toBe(false);
    expect(chargeSchema.safeParse({ patientId: 1, amount: 10.5 }).success).toBe(false);
    expect(chargeSchema.safeParse({ patientId: 1, amount: 1000, discount: 100, paid: 900 }).success).toBe(true);
  });
});

describe("roles", () => {
  it("give reception nothing medical and nurses only vitals", () => {
    expect(CLINICAL_OF.reception).toBe("none");
    expect(CLINICAL_OF.nurse).toBe("vitals");
    expect(CLINICAL_OF.doctor).toBe("full");
  });
  it("never give a staff login an owner screen", () => {
    for (const list of Object.values(ROLE_SECTIONS)) for (const s of list) expect(STAFF_SECTIONS).toContain(s);
    for (const s of OWNER_SECTIONS) expect(STAFF_SECTIONS).not.toContain(s);
  });
});
