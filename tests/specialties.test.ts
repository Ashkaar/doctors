import { describe, expect, it } from "vitest";
import {
  ageInMonths,
  clinicTypesSchema,
  eddFromLmp,
  formatPower,
  gestation,
  normaliseTypes,
  parsePower,
  percentileOf,
  percentileValue,
  toothStateSchema,
  zScore,
} from "@/lib/specialties";

describe("clinic types", () => {
  it("need at least one known type, without repeats", () => {
    expect(clinicTypesSchema.parse(["dental", "dental", "eye"])).toEqual(["dental", "eye"]);
    expect(clinicTypesSchema.safeParse([]).success).toBe(false);
    expect(normaliseTypes(["vet"])).toBeNull();
    expect(normaliseTypes(undefined)).toBeNull();
  });
});

describe("dental chart", () => {
  it("accepts only known conditions and surfaces", () => {
    expect(toothStateSchema.safeParse({ conditions: ["caries"], surfaces: { caries: ["o", "m"] } }).success).toBe(true);
    expect(toothStateSchema.safeParse({ conditions: ["gold"], surfaces: {} }).success).toBe(false);
    expect(toothStateSchema.safeParse({ conditions: ["caries"], surfaces: { caries: ["x"] } }).success).toBe(false);
  });
});

describe("eye exam", () => {
  it("reads and writes lens powers in hundredths of a dioptre", () => {
    expect(parsePower("-1.25")).toBe(-125);
    expect(parsePower("+0.5")).toBe(50);
    expect(parsePower("−2,75")).toBe(-275);
    expect(parsePower("plano")).toBe(0);
    expect(parsePower("")).toBeNull();
    expect(parsePower("abc")).toBeUndefined();
    expect(parsePower("45")).toBeUndefined();
    expect(formatPower(-125)).toBe("−1.25");
    expect(formatPower(200)).toBe("+2.00");
    expect(formatPower(null)).toBe("");
  });
});

describe("growth (WHO standards)", () => {
  it("puts the median boy at birth at 3.35 kg, on the 50th percentile", () => {
    expect(percentileValue("weight", "m", 0, 0)).toBeCloseTo(3.346, 2);
    expect(zScore("weight", "m", 0, 3.3464)).toBeCloseTo(0, 3);
  });
  it("gives the known medians at one year", () => {
    expect(percentileValue("weight", "f", 12, 0)).toBeCloseTo(8.95, 1);
    expect(percentileValue("height", "m", 12, 0)).toBeCloseTo(75.7, 0);
  });
  it("turns z-scores into percentiles", () => {
    expect(percentileOf(0)).toBeCloseTo(50, 1);
    expect(percentileOf(1.881)).toBeCloseTo(97, 0);
    expect(percentileOf(-1.881)).toBeCloseTo(3, 0);
  });
  it("works out age in months and refuses ages outside 0–5 years", () => {
    expect(ageInMonths("2025-11-27", "2026-11-27")).toBeCloseTo(12, 0);
    expect(ageInMonths("2026-12-01", "2026-11-27")).toBeNull();
    expect(percentileValue("weight", "m", 61, 0)).toBeNull();
  });
});

describe("pregnancy dates", () => {
  it("puts the due date 280 days after the last period", () => {
    expect(eddFromLmp("2026-01-01")).toBe("2026-10-08");
  });
  it("counts weeks and days from the due date", () => {
    expect(gestation("2026-10-08", "2026-01-01")).toEqual({ weeks: 0, days: 0 });
    expect(gestation("2026-10-08", "2026-03-01")).toEqual({ weeks: 8, days: 3 });
    expect(gestation("2026-10-08", "2026-10-08")).toEqual({ weeks: 40, days: 0 });
    expect(gestation("2026-10-08", "2025-12-01")).toBeNull();
  });
});
