import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import type { z } from "zod";
import { parseVitals, type Order, type RxItem, type Visit, type VisitSummary, type visitSaveSchema, type Vitals } from "./clinic";
import { getDb } from "./db";
import { orders, prescriptionItems, visits } from "./db/schema";
import type { Clinical } from "./sections";

// Visits: the medical record. What leaves this file depends on the login:
// - full:   everything;
// - vitals: the visit's date, doctor and vitals only;
// - none:   the date and doctor only (reception sees that a visit happened).

type Row = typeof visits.$inferSelect;

function summary(r: Row, clinical: Clinical): VisitSummary {
  return { id: r.id, patientId: r.patientId, doctorId: r.doctorId, at: r.at, diagnosis: clinical === "full" ? r.diagnosis : null };
}

export async function listVisits(patientId: number, clinical: Clinical): Promise<VisitSummary[]> {
  const db = await getDb();
  const rows = await db.select().from(visits).where(eq(visits.patientId, patientId)).orderBy(desc(visits.at)).limit(200);
  return rows.map((r) => summary(r, clinical));
}

export async function getVisit(id: number, clinical: Clinical): Promise<Visit | null> {
  const db = await getDb();
  const [r] = await db.select().from(visits).where(eq(visits.id, id));
  if (!r) return null;
  const full = clinical === "full";
  const items: RxItem[] = full
    ? (await db.select().from(prescriptionItems).where(eq(prescriptionItems.visitId, id)).orderBy(asc(prescriptionItems.sort))).map((i) => ({
        medicine: i.medicine,
        dose: i.dose,
        frequency: i.frequency,
        duration: i.duration,
        notes: i.notes,
      }))
    : [];
  const hide = (v: string) => (full ? v : "");
  return {
    ...summary(r, clinical),
    complaint: hide(r.complaint),
    history: hide(r.history),
    examination: hide(r.examination),
    plan: hide(r.plan),
    rxNotes: hide(r.rxNotes),
    followUp: hide(r.followUp),
    vitals: clinical === "none" ? {} : parseVitals(r.vitals),
    items,
    createdBy: r.createdBy,
  };
}

export async function createVisit(input: { patientId: number; doctorId: number; day: string; by: string }): Promise<number> {
  const db = await getDb();
  const now = Date.now();
  const [row] = await db
    .insert(visits)
    .values({ patientId: input.patientId, doctorId: input.doctorId, at: now, day: input.day, createdBy: input.by, createdAt: now, updatedAt: now })
    .returning({ id: visits.id });
  return row.id;
}

// Saves what this login may change: vitals (nurse and up); notes and the
// prescription (full record only). Items replace the visit's prescription.
export async function saveVisit(id: number, input: z.infer<typeof visitSaveSchema>, clinical: Clinical, withPrescription: boolean): Promise<boolean> {
  const db = await getDb();
  const set: Partial<typeof visits.$inferInsert> = { updatedAt: Date.now() };
  if (input.vitals && clinical !== "none") set.vitals = JSON.stringify(input.vitals satisfies Vitals);
  if (clinical === "full") {
    if (input.notes) Object.assign(set, input.notes);
    if (input.doctorId) set.doctorId = input.doctorId;
  }
  if (!withPrescription) delete set.rxNotes;
  const rows = await db.update(visits).set(set).where(eq(visits.id, id)).returning({ id: visits.id });
  if (!rows.length) return false;
  if (clinical === "full" && withPrescription && input.items) {
    await db.delete(prescriptionItems).where(eq(prescriptionItems.visitId, id));
    if (input.items.length) await db.insert(prescriptionItems).values(input.items.map((item, sort) => ({ ...item, visitId: id, sort })));
  }
  return true;
}

export async function visitPatientId(id: number): Promise<number | null> {
  const db = await getDb();
  const [r] = await db.select({ patientId: visits.patientId }).from(visits).where(eq(visits.id, id));
  return r?.patientId ?? null;
}

// Visit ids that carry a prescription, for a patient's history.
export async function visitsWithPrescription(patientId: number): Promise<Set<number>> {
  const db = await getDb();
  const rows = await db
    .selectDistinct({ id: prescriptionItems.visitId })
    .from(prescriptionItems)
    .innerJoin(visits, eq(visits.id, prescriptionItems.visitId))
    .where(eq(visits.patientId, patientId));
  return new Set(rows.map((r) => r.id));
}

// ---- Lab and imaging orders -------------------------------------------------

function toOrder(r: typeof orders.$inferSelect): Order {
  return {
    id: r.id,
    patientId: r.patientId,
    visitId: r.visitId,
    kind: r.kind === "imaging" ? "imaging" : "lab",
    name: r.name,
    status: r.status === "done" ? "done" : "ordered",
    result: r.result,
    createdAt: r.createdAt,
    doneAt: r.doneAt,
  };
}

export async function listOrders(patientId: number, visitId?: number): Promise<Order[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(orders)
    .where(and(eq(orders.patientId, patientId), visitId ? eq(orders.visitId, visitId) : undefined))
    .orderBy(desc(orders.createdAt));
  return rows.map(toOrder);
}

export async function createOrder(input: { patientId: number; visitId: number | null; kind: "lab" | "imaging"; name: string }): Promise<Order> {
  const db = await getDb();
  const [row] = await db
    .insert(orders)
    .values({ ...input, status: "ordered", createdAt: Date.now() })
    .returning();
  return toOrder(row);
}

export async function updateOrder(id: number, input: { status: "ordered" | "done"; result: string }): Promise<Order | null> {
  const db = await getDb();
  const [row] = await db
    .update(orders)
    .set({ status: input.status, result: input.result, doneAt: input.status === "done" ? Date.now() : null })
    .where(eq(orders.id, id))
    .returning();
  return row ? toOrder(row) : null;
}

export async function deleteOrder(id: number): Promise<{ patientId: number } | null> {
  const db = await getDb();
  const [row] = await db.delete(orders).where(eq(orders.id, id)).returning({ patientId: orders.patientId });
  return row ?? null;
}

export async function getOrder(id: number): Promise<Order | null> {
  const db = await getDb();
  const [row] = await db.select().from(orders).where(eq(orders.id, id));
  return row ? toOrder(row) : null;
}
