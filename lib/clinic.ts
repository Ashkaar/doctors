import { z } from "zod";

// The clinic's records: shared types and validation (client and server).
// Money is integer hundredths of the clinic's currency; days are
// "YYYY-MM-DD" in the clinic's time zone; times are ms since 1970.

const short = (max: number) => z.string().trim().max(max);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const id = z.number().int().positive();
const cents = z.number().int().min(0).max(1_000_000_000_00);

// ---- Doctors ---------------------------------------------------------------

export interface Doctor {
  id: number;
  name: string;
  specialty: string;
  phone: string;
  licence: string;
  room: string;
  staffId: number | null;
  // Share of their fees, in hundredths of a percent (5000 = 50%).
  shareBp: number;
  slotMinutes: number;
  active: boolean;
}

export const doctorSchema = z.object({
  name: short(60).min(1),
  specialty: short(80).default(""),
  phone: short(30).default(""),
  licence: short(40).default(""),
  room: short(20).default(""),
  staffId: id.nullable().default(null),
  shareBp: z.number().int().min(0).max(10_000).default(0),
  slotMinutes: z.number().int().min(5).max(240).default(15),
  active: z.boolean().default(true),
});

// ---- Patients --------------------------------------------------------------

export const GENDERS = ["", "f", "m"] as const;
export type Gender = (typeof GENDERS)[number];
export const BLOOD_GROUPS = ["", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

export interface PatientSummary {
  id: number;
  fileNo: number;
  name: string;
  phone: string;
  gender: Gender;
  birthDate: string;
  lastVisitAt: number | null;
}

export interface Patient extends PatientSummary {
  bloodGroup: string;
  address: string;
  notes: string;
  // Medical alerts: only sent to logins that may see them (nurse and up).
  allergies: string | null;
  conditions: string | null;
  createdAt: number;
  updatedAt: number;
}

const birthDate = z.union([z.literal(""), z.string().regex(/^\d{4}(-\d{2}-\d{2})?$/)]);

export const patientSchema = z.object({
  name: short(80).min(1),
  phone: short(30).default(""),
  gender: z.enum(GENDERS).default(""),
  birthDate: birthDate.default(""),
  bloodGroup: z.enum(BLOOD_GROUPS).default(""),
  address: short(200).default(""),
  notes: short(1000).default(""),
  allergies: short(500).optional(),
  conditions: short(500).optional(),
});

// Age in whole years on `today` ("YYYY-MM-DD"), from "YYYY" or "YYYY-MM-DD".
export function ageOn(birthDate: string, today: string): number | null {
  const m = /^(\d{4})(?:-(\d{2})-(\d{2}))?$/.exec(birthDate);
  if (!m) return null;
  const [ty, tm, td] = today.split("-").map(Number);
  let age = ty - Number(m[1]);
  if (m[2] && (tm < Number(m[2]) || (tm === Number(m[2]) && td < Number(m[3])))) age--;
  return age >= 0 && age < 150 ? age : null;
}

// ---- Appointments and queue ------------------------------------------------

export const APPOINTMENT_STATUSES = ["booked", "arrived", "done", "cancelled", "noShow"] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export interface Appointment {
  id: number;
  patientId: number;
  patientName: string;
  fileNo: number;
  phone: string;
  doctorId: number;
  day: string;
  startMin: number;
  durationMin: number;
  status: AppointmentStatus;
  reason: string;
}

export const appointmentSchema = z.object({
  patientId: id,
  doctorId: id,
  day,
  startMin: z.number().int().min(0).max(24 * 60 - 1),
  durationMin: z.number().int().min(5).max(480).default(15),
  reason: short(200).default(""),
});

export const QUEUE_STATUSES = ["waiting", "called", "inRoom", "done", "left"] as const;
export type QueueStatus = (typeof QUEUE_STATUSES)[number];

export interface QueueTicket {
  id: number;
  day: string;
  number: number;
  patientId: number;
  patientName: string;
  fileNo: number;
  doctorId: number;
  appointmentId: number | null;
  visitId: number | null;
  status: QueueStatus;
  calledAt: number | null;
  createdAt: number;
}

// What the waiting-room screen shows: numbers and doctors, never patients.
export interface ScreenState {
  clinic: string;
  calls: { number: number; doctor: string; room: string; calledAt: number }[];
  waiting: number;
}

// "09:30" ↔ 570
export const minutesToTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
export function timeToMinutes(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : null;
}

// ---- Visits ----------------------------------------------------------------

export interface Vitals {
  bpSys?: number;
  bpDia?: number;
  pulse?: number;
  // Temperature in tenths of a degree Celsius (375 = 37.5 °C).
  tempC10?: number;
  spo2?: number;
  resp?: number;
  // Weight in grams, height in millimetres.
  weightG?: number;
  heightMm?: number;
  // Blood sugar in mg/dL.
  sugar?: number;
}

const vital = (max: number) => z.number().int().min(0).max(max).optional();
export const vitalsSchema = z
  .object({
    bpSys: vital(400),
    bpDia: vital(300),
    pulse: vital(400),
    tempC10: vital(500),
    spo2: vital(100),
    resp: vital(200),
    weightG: vital(500_000),
    heightMm: vital(3000),
    sugar: vital(3000),
  })
  .strict();

export function parseVitals(raw: string): Vitals {
  try {
    const r = vitalsSchema.safeParse(JSON.parse(raw));
    return r.success ? r.data : {};
  } catch {
    return {};
  }
}

export interface RxItem {
  medicine: string;
  dose: string;
  frequency: string;
  duration: string;
  notes: string;
}

export const rxItemSchema = z.object({
  medicine: short(120).min(1),
  dose: short(60).default(""),
  frequency: short(60).default(""),
  duration: short(60).default(""),
  notes: short(200).default(""),
});

export const ORDER_KINDS = ["lab", "imaging"] as const;
export type OrderKind = (typeof ORDER_KINDS)[number];

export interface Order {
  id: number;
  patientId: number;
  visitId: number | null;
  kind: OrderKind;
  name: string;
  status: "ordered" | "done";
  result: string;
  createdAt: number;
  doneAt: number | null;
}

export const orderSchema = z.object({ kind: z.enum(ORDER_KINDS), name: short(120).min(1) });
export const orderResultSchema = z.object({ status: z.enum(["ordered", "done"]), result: short(2000).default("") });

export interface VisitSummary {
  id: number;
  patientId: number;
  doctorId: number;
  at: number;
  // Only for logins with the full record.
  diagnosis: string | null;
}

export interface Visit extends VisitSummary {
  complaint: string;
  history: string;
  examination: string;
  plan: string;
  rxNotes: string;
  followUp: string;
  vitals: Vitals;
  items: RxItem[];
  createdBy: string;
}

export const visitNotesSchema = z.object({
  complaint: short(2000),
  history: short(4000),
  examination: short(4000),
  diagnosis: short(1000),
  plan: short(4000),
  rxNotes: short(1000),
  followUp: short(200),
}).partial();

export const visitSaveSchema = z.object({
  notes: visitNotesSchema.optional(),
  vitals: vitalsSchema.optional(),
  items: z.array(rxItemSchema).max(30).optional(),
  doctorId: id.optional(),
});

// ---- Medicines -------------------------------------------------------------

export interface Medicine {
  id: number;
  name: string;
  form: string;
  dose: string;
  frequency: string;
  duration: string;
  active: boolean;
}

export const medicineSchema = z.object({
  name: short(120).min(1),
  form: short(40).default(""),
  dose: short(60).default(""),
  frequency: short(60).default(""),
  duration: short(60).default(""),
  active: z.boolean().default(true),
});

// ---- Files -----------------------------------------------------------------

export const FILE_KINDS = ["lab", "imaging", "report", "other"] as const;
export type FileKind = (typeof FILE_KINDS)[number];
export const FILE_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
// Vercel functions take request bodies up to about 4.5 MB.
export const MAX_FILE_BYTES = 4 * 1024 * 1024;

export interface PatientFile {
  id: number;
  patientId: number;
  visitId: number | null;
  kind: FileKind;
  title: string;
  mime: string;
  size: number;
  createdAt: number;
  createdBy: string;
}

// ---- Money -----------------------------------------------------------------

export interface Service {
  id: number;
  name: string;
  price: number;
  active: boolean;
}

export const serviceSchema = z.object({ name: short(80).min(1), price: cents, active: z.boolean().default(true) });

export const PAYMENT_METHODS = ["cash", "card", "transfer"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export interface Charge {
  id: number;
  patientId: number;
  patientName: string;
  visitId: number | null;
  doctorId: number | null;
  description: string;
  amount: number;
  discount: number;
  at: number;
  createdBy: string;
  voided: boolean;
}

export interface Payment {
  id: number;
  patientId: number;
  patientName: string;
  amount: number;
  method: PaymentMethod;
  at: number;
  createdBy: string;
  voided: boolean;
}

export const chargeSchema = z
  .object({
    patientId: id,
    visitId: id.nullable().default(null),
    doctorId: id.nullable().default(null),
    serviceId: id.nullable().default(null),
    description: short(120).default(""),
    amount: cents,
    discount: cents.default(0),
    // Paid now, in full or in part.
    paid: cents.default(0),
    method: z.enum(PAYMENT_METHODS).default("cash"),
  })
  .refine((c) => c.discount <= c.amount, { path: ["discount"] });

export const paymentSchema = z.object({ patientId: id, amount: cents.min(1), method: z.enum(PAYMENT_METHODS).default("cash") });

export interface Expense {
  id: number;
  day: string;
  category: string;
  description: string;
  amount: number;
  createdBy: string;
}

export const expenseSchema = z.object({ day, category: short(60).default(""), description: short(200).default(""), amount: cents.min(1) });

export const daySchema = day;
