import "server-only";
import { and, desc, eq, exists, like, or, sql, type SQL } from "drizzle-orm";
import type { z } from "zod";
import type { Gender, Patient, PatientSummary, patientSchema } from "./clinic";
import { getDb } from "./db";
import { ancChecks, appointments, charges, dentalTeeth, dentalWork, eyeExams, orders, patientFileData, patientFiles, patients, payments, pregnancies, prescriptionItems, queue, vaccinations, visits } from "./db/schema";
import type { Viewer } from "./sections";

// Patients. What a login may see is decided here, once:
// - a doctor with "own patients only" sees just the patients they have an
//   appointment, a queue turn or a visit with;
// - allergies and conditions go only to logins that see vitals or more.

const lastVisit = sql<number | null>`(SELECT MAX(${visits.at}) FROM ${visits} WHERE ${visits.patientId} = ${patients.id})`;

// The condition that limits a doctor to their own patients (undefined: no limit).
export function ownPatientsFilter(viewer: Viewer): SQL | undefined {
  if (!viewer.ownPatientsOnly) return undefined;
  const doctorId = viewer.doctorId ?? -1;
  return or(
    exists(sql`SELECT 1 FROM ${appointments} WHERE ${appointments.patientId} = ${patients.id} AND ${appointments.doctorId} = ${doctorId}`),
    exists(sql`SELECT 1 FROM ${queue} WHERE ${queue.patientId} = ${patients.id} AND ${queue.doctorId} = ${doctorId}`),
    exists(sql`SELECT 1 FROM ${visits} WHERE ${visits.patientId} = ${patients.id} AND ${visits.doctorId} = ${doctorId}`),
  );
}

const asGender = (g: string): Gender => (g === "f" || g === "m" ? g : "");

function toSummary(r: { id: number; fileNo: number; name: string; phone: string; gender: string; birthDate: string; lastVisitAt: number | null }): PatientSummary {
  return { id: r.id, fileNo: r.fileNo, name: r.name, phone: r.phone, gender: asGender(r.gender), birthDate: r.birthDate, lastVisitAt: r.lastVisitAt == null ? null : Number(r.lastVisitAt) };
}

const summaryColumns = {
  id: patients.id,
  fileNo: patients.fileNo,
  name: patients.name,
  phone: patients.phone,
  gender: patients.gender,
  birthDate: patients.birthDate,
  lastVisitAt: lastVisit,
};

// Search by name, phone or file number. Newest first without a search.
export async function searchPatients(viewer: Viewer, query: string, limit = 50): Promise<PatientSummary[]> {
  const db = await getDb();
  const q = query.trim().slice(0, 80);
  let match: SQL | undefined;
  if (q) {
    const digits = q.replace(/[^\d]/g, "");
    const words = q.split(/\s+/).filter(Boolean).slice(0, 4);
    match = or(
      and(...words.map((w) => like(patients.name, `%${w.replace(/[%_\\]/g, (c) => `\\${c}`)}%`))),
      digits.length >= 3 ? like(sql`replace(${patients.phone}, ' ', '')`, `%${digits}%`) : undefined,
      /^\d+$/.test(q) ? eq(patients.fileNo, Number(q)) : undefined,
    );
  }
  const rows = await db
    .select(summaryColumns)
    .from(patients)
    .where(and(match, ownPatientsFilter(viewer)))
    .orderBy(desc(patients.id))
    .limit(limit);
  return rows.map(toSummary);
}

export async function countPatients(): Promise<number> {
  const db = await getDb();
  const [row] = await db.select({ n: sql<number>`count(*)` }).from(patients);
  return Number(row?.n ?? 0);
}

// One patient, or null when there is none this login may open.
export async function getPatient(viewer: Viewer, id: number): Promise<Patient | null> {
  const db = await getDb();
  const [r] = await db
    .select({ ...summaryColumns, bloodGroup: patients.bloodGroup, address: patients.address, notes: patients.notes, allergies: patients.allergies, conditions: patients.conditions, createdAt: patients.createdAt, updatedAt: patients.updatedAt })
    .from(patients)
    .where(and(eq(patients.id, id), ownPatientsFilter(viewer)));
  if (!r) return null;
  const alerts = viewer.clinical !== "none";
  return {
    ...toSummary(r),
    bloodGroup: r.bloodGroup,
    address: r.address,
    notes: r.notes,
    allergies: alerts ? r.allergies : null,
    conditions: alerts ? r.conditions : null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export async function canSeePatient(viewer: Viewer, id: number): Promise<boolean> {
  if (!viewer.ownPatientsOnly) return true;
  const db = await getDb();
  const rows = await db
    .select({ id: patients.id })
    .from(patients)
    .where(and(eq(patients.id, id), ownPatientsFilter(viewer)));
  return rows.length > 0;
}

export async function patientName(id: number): Promise<{ name: string; fileNo: number } | null> {
  const db = await getDb();
  const [r] = await db.select({ name: patients.name, fileNo: patients.fileNo }).from(patients).where(eq(patients.id, id));
  return r ?? null;
}

type PatientInput = z.infer<typeof patientSchema>;

export async function createPatient(viewer: Viewer, input: PatientInput): Promise<Patient> {
  const db = await getDb();
  const now = Date.now();
  // The next file number; retried if two receptions save at the same moment.
  for (let attempt = 0; ; attempt++) {
    try {
      const [row] = await db
        .insert(patients)
        .values({
          fileNo: sql`(SELECT COALESCE(MAX(${patients.fileNo}), 0) + 1 FROM ${patients})`,
          name: input.name,
          phone: input.phone,
          gender: input.gender,
          birthDate: input.birthDate,
          bloodGroup: input.bloodGroup,
          address: input.address,
          notes: input.notes,
          allergies: viewer.clinical !== "none" ? (input.allergies ?? "") : "",
          conditions: viewer.clinical !== "none" ? (input.conditions ?? "") : "",
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: patients.id });
      return (await getPatient({ ...viewer, ownPatientsOnly: false }, row.id))!;
    } catch (err) {
      if (attempt < 3 && String(err).includes("UNIQUE")) continue;
      throw err;
    }
  }
}

export async function updatePatient(viewer: Viewer, id: number, input: PatientInput): Promise<Patient | null> {
  const db = await getDb();
  const set: Partial<typeof patients.$inferInsert> = {
    name: input.name,
    phone: input.phone,
    gender: input.gender,
    birthDate: input.birthDate,
    bloodGroup: input.bloodGroup,
    address: input.address,
    notes: input.notes,
    updatedAt: Date.now(),
  };
  // Reception can't see the medical alerts, so never overwrites them.
  if (viewer.clinical !== "none") {
    if (input.allergies !== undefined) set.allergies = input.allergies;
    if (input.conditions !== undefined) set.conditions = input.conditions;
  }
  const rows = await db.update(patients).set(set).where(eq(patients.id, id)).returning({ id: patients.id });
  return rows.length ? getPatient(viewer, id) : null;
}

// Deletes a patient and everything recorded about them. Owner only (the
// route checks); can't be undone.
export async function deletePatient(id: number): Promise<boolean> {
  const db = await getDb();
  const visitIds = (await db.select({ id: visits.id }).from(visits).where(eq(visits.patientId, id))).map((v) => v.id);
  const fileIds = (await db.select({ id: patientFiles.id }).from(patientFiles).where(eq(patientFiles.patientId, id))).map((f) => f.id);
  const client = db.$client;
  const inList = (ids: number[]) => (ids.length ? ids.join(",") : "-1");
  await client.batch(
    [
      { sql: `DELETE FROM prescription_items WHERE visit_id IN (${inList(visitIds)})`, args: [] },
      { sql: `DELETE FROM patient_file_data WHERE file_id IN (${inList(fileIds)})`, args: [] },
      { sql: "DELETE FROM patient_files WHERE patient_id = ?", args: [id] },
      { sql: "DELETE FROM orders WHERE patient_id = ?", args: [id] },
      { sql: "DELETE FROM visits WHERE patient_id = ?", args: [id] },
      { sql: "DELETE FROM queue WHERE patient_id = ?", args: [id] },
      { sql: "DELETE FROM appointments WHERE patient_id = ?", args: [id] },
      { sql: "DELETE FROM charges WHERE patient_id = ?", args: [id] },
      { sql: "DELETE FROM payments WHERE patient_id = ?", args: [id] },
      { sql: "DELETE FROM dental_teeth WHERE patient_id = ?", args: [id] },
      { sql: "DELETE FROM dental_work WHERE patient_id = ?", args: [id] },
      { sql: "DELETE FROM eye_exams WHERE patient_id = ?", args: [id] },
      { sql: "DELETE FROM vaccinations WHERE patient_id = ?", args: [id] },
      { sql: "DELETE FROM anc_checks WHERE patient_id = ?", args: [id] },
      { sql: "DELETE FROM pregnancies WHERE patient_id = ?", args: [id] },
      { sql: "DELETE FROM patients WHERE id = ?", args: [id] },
    ],
    "write",
  );
  return true;
}

// Kept for the type checker: every table that holds patient data, so a new
// one isn't forgotten in deletePatient() above and exportAll().
export const PATIENT_TABLES = [patients, appointments, queue, visits, prescriptionItems, orders, patientFiles, patientFileData, charges, payments, dentalTeeth, dentalWork, eyeExams, vaccinations, pregnancies, ancChecks] as const;
