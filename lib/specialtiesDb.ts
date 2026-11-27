import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import type { z } from "zod";
import { parseVitals } from "./clinic";
import { getDb } from "./db";
import { ancChecks, dentalTeeth, dentalWork, eyeExams, pregnancies, vaccinations, visits } from "./db/schema";
import {
  DENTAL_PROCEDURES,
  eddFromLmp,
  eyeExamSchema,
  SURFACES,
  TOOTH_CONDITIONS,
  type AncCheck,
  type ancCheckSchema,
  type DentalProcedure,
  type DentalWork,
  type dentalWorkSchema,
  type EyeExam,
  type Pregnancy,
  type pregnancySchema,
  type Surface,
  type ToothCondition,
  type ToothState,
  type toothStateSchema,
  type Vaccination,
  type vaccinationSchema,
} from "./specialties";

// The specialty charts' records, always for one patient. Access is checked
// by the API routes (lib/guards.ts) before anything here runs.

const json = <T>(raw: string, fallback: T): T => {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

// ---- Dental -------------------------------------------------------------------

function toTooth(r: typeof dentalTeeth.$inferSelect): ToothState {
  const conditions = json<string[]>(r.conditions, []).filter((c): c is ToothCondition => TOOTH_CONDITIONS.includes(c as ToothCondition));
  const raw = json<Record<string, string[]>>(r.surfaces, {});
  const surfaces: ToothState["surfaces"] = {};
  for (const c of conditions) {
    const list = (raw[c] ?? []).filter((s): s is Surface => SURFACES.includes(s as Surface));
    if (list.length) surfaces[c] = list;
  }
  return { tooth: r.tooth, conditions, surfaces, note: r.note, updatedAt: r.updatedAt };
}

export async function listTeeth(patientId: number): Promise<ToothState[]> {
  const db = await getDb();
  return (await db.select().from(dentalTeeth).where(eq(dentalTeeth.patientId, patientId))).map(toTooth);
}

// Saves a tooth's state; a tooth with nothing on it is removed.
export async function saveTooth(patientId: number, tooth: number, input: z.infer<typeof toothStateSchema>): Promise<ToothState | null> {
  const db = await getDb();
  const empty = input.conditions.length === 0 && !input.note.trim();
  if (empty) {
    await db.delete(dentalTeeth).where(and(eq(dentalTeeth.patientId, patientId), eq(dentalTeeth.tooth, tooth)));
    return null;
  }
  const surfaces = Object.fromEntries(Object.entries(input.surfaces).filter(([c]) => input.conditions.includes(c as ToothCondition)));
  const values = { patientId, tooth, conditions: JSON.stringify(input.conditions), surfaces: JSON.stringify(surfaces), note: input.note, updatedAt: Date.now() };
  const [row] = await db
    .insert(dentalTeeth)
    .values(values)
    .onConflictDoUpdate({ target: [dentalTeeth.patientId, dentalTeeth.tooth], set: { conditions: values.conditions, surfaces: values.surfaces, note: values.note, updatedAt: values.updatedAt } })
    .returning();
  return toTooth(row);
}

function toWork(r: typeof dentalWork.$inferSelect): DentalWork {
  return {
    id: r.id,
    patientId: r.patientId,
    visitId: r.visitId,
    tooth: r.tooth,
    procedure: DENTAL_PROCEDURES.includes(r.procedure as DentalProcedure) ? (r.procedure as DentalProcedure) : "other",
    surfaces: json<string[]>(r.surfaces, []).filter((s): s is Surface => SURFACES.includes(s as Surface)),
    status: r.status === "done" ? "done" : "planned",
    fee: r.fee,
    note: r.note,
    chargeId: r.chargeId,
    createdAt: r.createdAt,
    doneAt: r.doneAt,
  };
}

export async function listWork(patientId: number): Promise<DentalWork[]> {
  const db = await getDb();
  return (await db.select().from(dentalWork).where(eq(dentalWork.patientId, patientId)).orderBy(asc(dentalWork.status), desc(dentalWork.createdAt))).map(toWork);
}

export async function getWork(id: number): Promise<DentalWork | null> {
  const db = await getDb();
  const [row] = await db.select().from(dentalWork).where(eq(dentalWork.id, id));
  return row ? toWork(row) : null;
}

export async function addWork(patientId: number, input: z.infer<typeof dentalWorkSchema>, by: string): Promise<DentalWork> {
  const db = await getDb();
  const [row] = await db
    .insert(dentalWork)
    .values({ patientId, visitId: input.visitId, tooth: input.tooth, procedure: input.procedure, surfaces: JSON.stringify(input.surfaces), fee: input.fee, note: input.note, status: "planned", createdBy: by, createdAt: Date.now() })
    .returning();
  return toWork(row);
}

export async function setWorkStatus(id: number, status: "planned" | "done", chargeId?: number | null): Promise<DentalWork | null> {
  const db = await getDb();
  const set: Partial<typeof dentalWork.$inferInsert> = { status, doneAt: status === "done" ? Date.now() : null };
  if (chargeId !== undefined) set.chargeId = chargeId;
  const [row] = await db.update(dentalWork).set(set).where(eq(dentalWork.id, id)).returning();
  return row ? toWork(row) : null;
}

export async function deleteWork(id: number): Promise<boolean> {
  const db = await getDb();
  return (await db.delete(dentalWork).where(eq(dentalWork.id, id)).returning({ id: dentalWork.id })).length > 0;
}

// ---- Eye --------------------------------------------------------------------------

export async function getEyeExam(visitId: number): Promise<EyeExam | null> {
  const db = await getDb();
  const [row] = await db.select().from(eyeExams).where(eq(eyeExams.visitId, visitId));
  if (!row) return null;
  const r = eyeExamSchema.safeParse(json(row.data, {}));
  return r.success ? r.data : null;
}

export async function saveEyeExam(patientId: number, visitId: number, exam: EyeExam): Promise<void> {
  const db = await getDb();
  const now = Date.now();
  await db
    .insert(eyeExams)
    .values({ patientId, visitId, data: JSON.stringify(exam), createdAt: now, updatedAt: now })
    .onConflictDoUpdate({ target: eyeExams.visitId, set: { data: JSON.stringify(exam), updatedAt: now } });
}

// A patient's exams, newest first, with the visit's time.
export async function listEyeExams(patientId: number): Promise<{ visitId: number; at: number; exam: EyeExam }[]> {
  const db = await getDb();
  const rows = await db
    .select({ visitId: eyeExams.visitId, data: eyeExams.data, at: visits.at })
    .from(eyeExams)
    .innerJoin(visits, eq(visits.id, eyeExams.visitId))
    .where(eq(eyeExams.patientId, patientId))
    .orderBy(desc(visits.at));
  return rows.flatMap((r) => {
    const exam = eyeExamSchema.safeParse(json(r.data, {}));
    return exam.success ? [{ visitId: r.visitId, at: r.at, exam: exam.data }] : [];
  });
}

// ---- Growth and vaccinations ------------------------------------------------------

// Weight, height and head size recorded at visits, oldest first.
export async function growthPoints(patientId: number): Promise<{ day: string; weightG?: number; heightMm?: number; headMm?: number }[]> {
  const db = await getDb();
  const rows = await db.select({ day: visits.day, vitals: visits.vitals }).from(visits).where(eq(visits.patientId, patientId)).orderBy(asc(visits.at));
  return rows.flatMap((r) => {
    const v = parseVitals(r.vitals);
    return v.weightG || v.heightMm || v.headMm ? [{ day: r.day, weightG: v.weightG, heightMm: v.heightMm, headMm: v.headMm }] : [];
  });
}

const toVaccination = (r: typeof vaccinations.$inferSelect): Vaccination => ({ id: r.id, patientId: r.patientId, vaccine: r.vaccine, givenOn: r.givenOn, batch: r.batch, note: r.note, createdBy: r.createdBy });

export async function listVaccinations(patientId: number): Promise<Vaccination[]> {
  const db = await getDb();
  return (await db.select().from(vaccinations).where(eq(vaccinations.patientId, patientId)).orderBy(asc(vaccinations.givenOn))).map(toVaccination);
}

export async function addVaccination(patientId: number, input: z.infer<typeof vaccinationSchema>, by: string): Promise<Vaccination> {
  const db = await getDb();
  const [row] = await db.insert(vaccinations).values({ patientId, ...input, createdBy: by, createdAt: Date.now() }).returning();
  return toVaccination(row);
}

export async function getVaccination(id: number): Promise<Vaccination | null> {
  const db = await getDb();
  const [row] = await db.select().from(vaccinations).where(eq(vaccinations.id, id));
  return row ? toVaccination(row) : null;
}

export async function deleteVaccination(id: number): Promise<boolean> {
  const db = await getDb();
  return (await db.delete(vaccinations).where(eq(vaccinations.id, id)).returning({ id: vaccinations.id })).length > 0;
}

// ---- Pregnancy ---------------------------------------------------------------------

function toPregnancy(r: typeof pregnancies.$inferSelect): Pregnancy {
  return {
    id: r.id,
    patientId: r.patientId,
    lmp: r.lmp,
    edd: r.edd,
    gravida: r.gravida,
    para: r.para,
    status: r.status === "delivered" || r.status === "ended" ? r.status : "active",
    endedOn: r.endedOn,
    outcome: r.outcome,
    notes: r.notes,
    createdAt: r.createdAt,
  };
}

export async function listPregnancies(patientId: number): Promise<Pregnancy[]> {
  const db = await getDb();
  return (await db.select().from(pregnancies).where(eq(pregnancies.patientId, patientId)).orderBy(desc(pregnancies.lmp))).map(toPregnancy);
}

export async function getPregnancy(id: number): Promise<Pregnancy | null> {
  const db = await getDb();
  const [row] = await db.select().from(pregnancies).where(eq(pregnancies.id, id));
  return row ? toPregnancy(row) : null;
}

export async function savePregnancy(patientId: number, input: z.infer<typeof pregnancySchema>, id?: number): Promise<Pregnancy | null> {
  const db = await getDb();
  const now = Date.now();
  const values = { ...input, edd: input.edd || eddFromLmp(input.lmp), updatedAt: now };
  if (id) {
    const [row] = await db.update(pregnancies).set(values).where(and(eq(pregnancies.id, id), eq(pregnancies.patientId, patientId))).returning();
    return row ? toPregnancy(row) : null;
  }
  const [row] = await db.insert(pregnancies).values({ ...values, patientId, createdAt: now }).returning();
  return toPregnancy(row);
}

const toCheck = (r: typeof ancChecks.$inferSelect): AncCheck => ({
  id: r.id,
  pregnancyId: r.pregnancyId,
  visitId: r.visitId,
  day: r.day,
  weightG: r.weightG,
  bpSys: r.bpSys,
  bpDia: r.bpDia,
  fhr: r.fhr,
  fundalCm: r.fundalCm,
  presentation: r.presentation,
  notes: r.notes,
});

export async function listChecks(pregnancyId: number): Promise<AncCheck[]> {
  const db = await getDb();
  return (await db.select().from(ancChecks).where(eq(ancChecks.pregnancyId, pregnancyId)).orderBy(asc(ancChecks.day), asc(ancChecks.id))).map(toCheck);
}

export async function addCheck(pregnancy: Pregnancy, input: z.infer<typeof ancCheckSchema>): Promise<AncCheck> {
  const db = await getDb();
  const [row] = await db.insert(ancChecks).values({ ...input, pregnancyId: pregnancy.id, patientId: pregnancy.patientId, createdAt: Date.now() }).returning();
  return toCheck(row);
}

export async function getCheck(id: number): Promise<AncCheck & { patientId: number } | null> {
  const db = await getDb();
  const [row] = await db.select().from(ancChecks).where(eq(ancChecks.id, id));
  return row ? { ...toCheck(row), patientId: row.patientId } : null;
}

export async function deleteCheck(id: number): Promise<boolean> {
  const db = await getDb();
  return (await db.delete(ancChecks).where(eq(ancChecks.id, id)).returning({ id: ancChecks.id })).length > 0;
}
