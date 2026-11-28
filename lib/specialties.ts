import { z } from "zod";
import { WHO_GROWTH, type Lms } from "./whoGrowthData";

// What kind of clinic this is decides which charts its patient files and
// visits show. A clinic can be several kinds; every kind keeps the usual
// visit notes. Client-safe (pure functions and Zod schemas).

export const CLINIC_TYPES = ["general", "dental", "eye", "children", "womens"] as const;
export type ClinicType = (typeof CLINIC_TYPES)[number];

export const clinicTypesSchema = z.array(z.enum(CLINIC_TYPES)).min(1).max(CLINIC_TYPES.length).transform((l) => [...new Set(l)]);

export function normaliseTypes(value: unknown): ClinicType[] | null {
  const r = clinicTypesSchema.safeParse(value);
  return r.success ? r.data : null;
}

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const short = (max: number) => z.string().trim().max(max);
const cents = z.number().int().min(0).max(1_000_000_000_00);

// ---- Dental -----------------------------------------------------------------
// Teeth are named in the FDI (ISO 3950) system: quadrant then position,
// 11–48 for adult teeth, 51–85 for baby teeth. Drawn as the dentist sees the
// patient: the patient's right on the viewer's left.

export const ADULT_UPPER = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
export const ADULT_LOWER = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];
export const CHILD_UPPER = [55, 54, 53, 52, 51, 61, 62, 63, 64, 65];
export const CHILD_LOWER = [85, 84, 83, 82, 81, 71, 72, 73, 74, 75];
export const ALL_TEETH = [...ADULT_UPPER, ...ADULT_LOWER, ...CHILD_UPPER, ...CHILD_LOWER];
export const isTooth = (n: number) => ALL_TEETH.includes(n);

// Molars and premolars have a chewing surface (occlusal); front teeth an edge (incisal).
export const isBackTooth = (n: number) => n % 10 >= 4;

export const TOOTH_CONDITIONS = ["caries", "filling", "crown", "rootCanal", "missing", "implant", "bridge", "fracture", "mobile", "extract"] as const;
export type ToothCondition = (typeof TOOTH_CONDITIONS)[number];
// Mesial, distal, buccal (cheek side), lingual (tongue side), occlusal/incisal.
export const SURFACES = ["m", "d", "b", "l", "o"] as const;
export type Surface = (typeof SURFACES)[number];

export interface ToothState {
  tooth: number;
  conditions: ToothCondition[];
  // Conditions on single surfaces (caries and fillings), e.g. { caries: ["o", "m"] }.
  surfaces: Partial<Record<ToothCondition, Surface[]>>;
  note: string;
  updatedAt: number;
}

export const toothStateSchema = z.object({
  conditions: z.array(z.enum(TOOTH_CONDITIONS)).max(TOOTH_CONDITIONS.length).transform((l) => [...new Set(l)]),
  surfaces: z.partialRecord(z.enum(TOOTH_CONDITIONS), z.array(z.enum(SURFACES)).max(5)).default({}),
  note: short(300).default(""),
});

export const DENTAL_PROCEDURES = ["exam", "cleaning", "filling", "rootCanal", "crown", "extraction", "implant", "bridge", "veneer", "whitening", "brace", "other"] as const;
export type DentalProcedure = (typeof DENTAL_PROCEDURES)[number];

export interface DentalWork {
  id: number;
  patientId: number;
  visitId: number | null;
  // null: the whole mouth (cleaning, whitening…).
  tooth: number | null;
  procedure: DentalProcedure;
  surfaces: Surface[];
  status: "planned" | "done";
  fee: number;
  note: string;
  chargeId: number | null;
  createdAt: number;
  doneAt: number | null;
}

export const dentalWorkSchema = z.object({
  tooth: z.number().int().refine(isTooth).nullable(),
  procedure: z.enum(DENTAL_PROCEDURES),
  surfaces: z.array(z.enum(SURFACES)).max(5).default([]),
  fee: cents.default(0),
  note: short(200).default(""),
  visitId: z.number().int().positive().nullable().default(null),
});

// ---- Eye exam ----------------------------------------------------------------
// One per visit. Refraction powers are kept in hundredths of a dioptre
// (-125 = -1.25 D); axis in degrees; pressure (IOP) in mmHg. Visual acuity
// is written as the clinic writes it ("6/6", "20/40", "CF 2m").

const power = z.number().int().min(-3000).max(3000).nullable().default(null);
const eyeSide = z.object({
  vaUnaided: short(20).default(""),
  vaCorrected: short(20).default(""),
  sph: power,
  cyl: power,
  axis: z.number().int().min(0).max(180).nullable().default(null),
  add: z.number().int().min(0).max(500).nullable().default(null),
  iop: z.number().int().min(0).max(90).nullable().default(null),
  anterior: short(1000).default(""),
  posterior: short(1000).default(""),
});
export const eyeExamSchema = z.object({
  od: eyeSide,
  os: eyeSide,
  // Pupil distance in millimetres.
  pd: z.number().int().min(30).max(90).nullable().default(null),
  notes: short(2000).default(""),
});
export type EyeExam = z.infer<typeof eyeExamSchema>;
export type EyeSide = EyeExam["od"];

export const emptyEyeExam = (): EyeExam => eyeExamSchema.parse({ od: {}, os: {} });

// "+1.25", "-0.50", "Plano" (0).
export function formatPower(hundredths: number | null): string {
  if (hundredths === null) return "";
  if (hundredths === 0) return "0.00";
  return `${hundredths > 0 ? "+" : "−"}${(Math.abs(hundredths) / 100).toFixed(2)}`;
}

export function parsePower(input: string): number | null | undefined {
  const v = input.replace(/[−–]/g, "-").replace(",", ".").replace(/\s/g, "").toLowerCase();
  if (v === "") return null;
  if (v === "pl" || v === "plano") return 0;
  if (!/^[+-]?\d{1,2}(\.\d{1,2})?$/.test(v)) return undefined;
  const n = Math.round(Number(v) * 100);
  // Lenses come in quarter-dioptre steps.
  return Math.abs(n) <= 3000 ? n : undefined;
}

// ---- Growth (WHO Child Growth Standards, 0–5 years) ---------------------------

export type GrowthMeasure = "weight" | "height" | "head";
export const GROWTH_MAX_MONTHS = 60;
// The standard's percentile lines and their z-scores.
export const PERCENTILES: { p: number; z: number }[] = [
  { p: 3, z: -1.881 },
  { p: 15, z: -1.036 },
  { p: 50, z: 0 },
  { p: 85, z: 1.036 },
  { p: 97, z: 1.881 },
];

// Age in months (with fractions) between a birth date and a day, both "YYYY-MM-DD".
export function ageInMonths(birth: string, on: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birth) || !/^\d{4}-\d{2}-\d{2}$/.test(on)) return null;
  const days = (Date.parse(`${on}T00:00:00Z`) - Date.parse(`${birth}T00:00:00Z`)) / 86_400_000;
  return days < 0 ? null : days / 30.4375;
}

function lmsAt(measure: GrowthMeasure, sex: "m" | "f", months: number): Lms | null {
  if (months < 0 || months > GROWTH_MAX_MONTHS) return null;
  const table = WHO_GROWTH[measure][sex];
  const lo = Math.floor(months);
  const hi = Math.min(GROWTH_MAX_MONTHS, lo + 1);
  const f = months - lo;
  const [l1, m1, s1] = table[lo];
  const [l2, m2, s2] = table[hi];
  return [l1 + (l2 - l1) * f, m1 + (m2 - m1) * f, s1 + (s2 - s1) * f];
}

// The value of a percentile line at an age: X = M(1 + L·S·z)^(1/L).
export function percentileValue(measure: GrowthMeasure, sex: "m" | "f", months: number, z: number): number | null {
  const lms = lmsAt(measure, sex, months);
  if (!lms) return null;
  const [l, m, s] = lms;
  return l === 0 ? m * Math.exp(s * z) : m * Math.pow(1 + l * s * z, 1 / l);
}

// The z-score of a measurement: z = ((X/M)^L − 1) / (L·S).
export function zScore(measure: GrowthMeasure, sex: "m" | "f", months: number, value: number): number | null {
  const lms = lmsAt(measure, sex, months);
  if (!lms || !(value > 0)) return null;
  const [l, m, s] = lms;
  return l === 0 ? Math.log(value / m) / s : (Math.pow(value / m, l) - 1) / (l * s);
}

// The percentile (0–100) for a z-score.
export function percentileOf(z: number): number {
  // Abramowitz–Stegun approximation of the normal distribution.
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return 100 * (z > 0 ? 1 - p : p);
}

// ---- Vaccinations -------------------------------------------------------------
// A starting list of a common childhood schedule (by age in months). Each
// clinic should check it against the Ministry of Health's current schedule;
// any vaccine can be recorded, on the list or not.

export const VACCINE_SCHEDULE: { id: string; name: string; months: number }[] = [
  { id: "bcg", name: "BCG", months: 0 },
  { id: "hepb0", name: "Hepatitis B (birth)", months: 0 },
  { id: "opv0", name: "OPV 0", months: 0 },
  { id: "penta1", name: "Pentavalent 1 (DTP-HepB-Hib)", months: 2 },
  { id: "opv1", name: "OPV 1", months: 2 },
  { id: "rota1", name: "Rotavirus 1", months: 2 },
  { id: "pcv1", name: "Pneumococcal 1", months: 2 },
  { id: "penta2", name: "Pentavalent 2", months: 4 },
  { id: "opv2", name: "OPV 2", months: 4 },
  { id: "ipv", name: "IPV", months: 4 },
  { id: "rota2", name: "Rotavirus 2", months: 4 },
  { id: "pcv2", name: "Pneumococcal 2", months: 4 },
  { id: "penta3", name: "Pentavalent 3", months: 6 },
  { id: "opv3", name: "OPV 3", months: 6 },
  { id: "pcv3", name: "Pneumococcal 3", months: 6 },
  { id: "measles", name: "Measles", months: 9 },
  { id: "mmr1", name: "MMR 1", months: 12 },
  { id: "dtp4", name: "DTP booster 1", months: 18 },
  { id: "opv4", name: "OPV booster 1", months: 18 },
  { id: "mmr2", name: "MMR 2", months: 18 },
  { id: "dtp5", name: "DTP booster 2", months: 48 },
  { id: "opv5", name: "OPV booster 2", months: 48 },
];

export interface Vaccination {
  id: number;
  patientId: number;
  vaccine: string;
  givenOn: string;
  batch: string;
  note: string;
  createdBy: string;
}

export const vaccinationSchema = z.object({
  vaccine: short(80).min(1),
  givenOn: day,
  batch: short(40).default(""),
  note: short(200).default(""),
});

// ---- Pregnancy ------------------------------------------------------------------

export interface Pregnancy {
  id: number;
  patientId: number;
  lmp: string;
  edd: string;
  gravida: number | null;
  para: number | null;
  status: "active" | "delivered" | "ended";
  endedOn: string;
  outcome: string;
  notes: string;
  createdAt: number;
}

export const pregnancySchema = z.object({
  lmp: day,
  // Empty: worked out from the last period (Naegele's rule, LMP + 280 days).
  edd: z.union([z.literal(""), day]).default(""),
  gravida: z.number().int().min(0).max(30).nullable().default(null),
  para: z.number().int().min(0).max(30).nullable().default(null),
  status: z.enum(["active", "delivered", "ended"]).default("active"),
  endedOn: z.union([z.literal(""), day]).default(""),
  outcome: short(200).default(""),
  notes: short(2000).default(""),
});

export interface AncCheck {
  id: number;
  pregnancyId: number;
  visitId: number | null;
  day: string;
  weightG: number | null;
  bpSys: number | null;
  bpDia: number | null;
  // Fetal heart rate (beats a minute) and fundal height (cm).
  fhr: number | null;
  fundalCm: number | null;
  presentation: string;
  notes: string;
}

const optInt = (max: number) => z.number().int().min(0).max(max).nullable().default(null);
export const ancCheckSchema = z.object({
  day,
  visitId: z.number().int().positive().nullable().default(null),
  weightG: optInt(300_000),
  bpSys: optInt(300),
  bpDia: optInt(250),
  fhr: optInt(250),
  fundalCm: optInt(60),
  presentation: short(40).default(""),
  notes: short(1000).default(""),
});

const DAY_MS = 86_400_000;
const toDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const fromDay = (d: string) => Date.parse(`${d}T00:00:00Z`);

export const eddFromLmp = (lmp: string): string => toDay(fromDay(lmp) + 280 * DAY_MS);

// Weeks and days pregnant on `on`, from the due date (so a due date moved
// by a scan moves the count too).
export function gestation(edd: string, on: string): { weeks: number; days: number } | null {
  const total = 280 - Math.round((fromDay(edd) - fromDay(on)) / DAY_MS);
  if (total < 0 || total > 315) return null;
  return { weeks: Math.floor(total / 7), days: total % 7 };
}
