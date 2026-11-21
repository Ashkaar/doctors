import "server-only";
import { and, gte, lt, sql } from "drizzle-orm";
import { getDb } from "./db";
import { charges, patients, payments, visits } from "./db/schema";
import { listDoctors } from "./doctorsDb";
import { dayStart } from "./format";
import { listExpenses } from "./moneyDb";
import { buildReport, type Report } from "./reports";
import { PAYMENT_METHODS, type PaymentMethod } from "./clinic";

export async function loadReport(from: string, to: string, timeZone: string, withShares: boolean): Promise<Report> {
  const db = await getDb();
  const [chargeRows, paymentRows, expenses, doctors, visitRows, newRows] = await Promise.all([
    db.select().from(charges).where(and(gte(charges.day, from), lt(charges.day, to))),
    db.select().from(payments).where(and(gte(payments.day, from), lt(payments.day, to))),
    listExpenses(from, to),
    listDoctors(),
    db
      .select({ doctorId: visits.doctorId, n: sql<number>`count(*)` })
      .from(visits)
      .where(and(gte(visits.day, from), lt(visits.day, to)))
      .groupBy(visits.doctorId),
    db
      .select({ n: sql<number>`count(*)` })
      .from(patients)
      .where(and(gte(patients.createdAt, dayStart(from, timeZone)), lt(patients.createdAt, dayStart(to, timeZone)))),
  ]);
  return buildReport({
    from,
    to,
    charges: chargeRows.map((c) => ({ ...c, patientName: "", voided: c.voidedAt != null })),
    payments: paymentRows.map((p) => ({ ...p, patientName: "", method: (PAYMENT_METHODS.includes(p.method as PaymentMethod) ? p.method : "cash") as PaymentMethod, voided: p.voidedAt != null })),
    expenses,
    doctors,
    visitsByDoctor: visitRows.map((v) => ({ doctorId: v.doctorId, n: Number(v.n) })),
    newPatients: Number(newRows[0]?.n ?? 0),
    withShares,
  });
}
