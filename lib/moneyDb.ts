import "server-only";
import { and, asc, desc, eq, gte, isNull, lt, sql } from "drizzle-orm";
import type { z } from "zod";
import { PAYMENT_METHODS, type Charge, type chargeSchema, type Expense, type expenseSchema, type Payment, type PaymentMethod, type Service, type serviceSchema } from "./clinic";
import { getDb } from "./db";
import { charges, expenses, patients, payments, services } from "./db/schema";

// Fees and money. The server works out every amount from the database (a
// service's price) or checks it; totals are never taken from the browser.

// ---- Services (the price list) --------------------------------------------

function toService(r: typeof services.$inferSelect): Service {
  return { id: r.id, name: r.name, price: r.price, active: r.active === 1 };
}

export async function listServices(activeOnly = false): Promise<Service[]> {
  const db = await getDb();
  const rows = await db.select().from(services).where(activeOnly ? eq(services.active, 1) : undefined).orderBy(asc(services.sort), asc(services.name));
  return rows.map(toService);
}

export async function getService(id: number): Promise<Service | null> {
  const db = await getDb();
  const [row] = await db.select().from(services).where(eq(services.id, id));
  return row ? toService(row) : null;
}

export async function createService(input: z.infer<typeof serviceSchema>): Promise<Service> {
  const db = await getDb();
  const [row] = await db
    .insert(services)
    .values({ name: input.name, price: input.price, active: input.active ? 1 : 0, createdAt: Date.now() })
    .returning();
  return toService(row);
}

export async function updateService(id: number, input: z.infer<typeof serviceSchema>): Promise<Service | null> {
  const db = await getDb();
  const [row] = await db
    .update(services)
    .set({ name: input.name, price: input.price, active: input.active ? 1 : 0 })
    .where(eq(services.id, id))
    .returning();
  return row ? toService(row) : null;
}

// ---- Charges and payments --------------------------------------------------

const asMethod = (m: string): PaymentMethod => (PAYMENT_METHODS.includes(m as PaymentMethod) ? (m as PaymentMethod) : "cash");

const chargeColumns = {
  id: charges.id,
  patientId: charges.patientId,
  patientName: patients.name,
  visitId: charges.visitId,
  doctorId: charges.doctorId,
  description: charges.description,
  amount: charges.amount,
  discount: charges.discount,
  at: charges.at,
  createdBy: charges.createdBy,
  voidedAt: charges.voidedAt,
};

const paymentColumns = {
  id: payments.id,
  patientId: payments.patientId,
  patientName: patients.name,
  amount: payments.amount,
  method: payments.method,
  at: payments.at,
  createdBy: payments.createdBy,
  voidedAt: payments.voidedAt,
};

type ChargeRow = { [K in keyof typeof chargeColumns]: unknown };
type PaymentRow = { [K in keyof typeof paymentColumns]: unknown };

const toCharge = (r: ChargeRow): Charge => ({
  id: Number(r.id),
  patientId: Number(r.patientId),
  patientName: String(r.patientName ?? ""),
  visitId: r.visitId == null ? null : Number(r.visitId),
  doctorId: r.doctorId == null ? null : Number(r.doctorId),
  description: String(r.description),
  amount: Number(r.amount),
  discount: Number(r.discount),
  at: Number(r.at),
  createdBy: String(r.createdBy ?? ""),
  voided: r.voidedAt != null,
});

const toPayment = (r: PaymentRow): Payment => ({
  id: Number(r.id),
  patientId: Number(r.patientId),
  patientName: String(r.patientName ?? ""),
  amount: Number(r.amount),
  method: asMethod(String(r.method)),
  at: Number(r.at),
  createdBy: String(r.createdBy ?? ""),
  voided: r.voidedAt != null,
});

export async function addCharge(input: z.infer<typeof chargeSchema> & { description: string }, day: string, by: string): Promise<{ charge: Charge; payment: Payment | null }> {
  const db = await getDb();
  const now = Date.now();
  const [row] = await db
    .insert(charges)
    .values({
      patientId: input.patientId,
      visitId: input.visitId,
      doctorId: input.doctorId,
      serviceId: input.serviceId,
      description: input.description,
      amount: input.amount,
      discount: input.discount,
      day,
      at: now,
      createdBy: by,
    })
    .returning({ id: charges.id });
  const payment = input.paid > 0 ? await addPayment({ patientId: input.patientId, amount: input.paid, method: input.method }, day, by) : null;
  const [c] = await db.select(chargeColumns).from(charges).innerJoin(patients, eq(patients.id, charges.patientId)).where(eq(charges.id, row.id));
  return { charge: toCharge(c), payment };
}

export async function addPayment(input: { patientId: number; amount: number; method: PaymentMethod }, day: string, by: string): Promise<Payment> {
  const db = await getDb();
  const [row] = await db
    .insert(payments)
    .values({ patientId: input.patientId, amount: input.amount, method: input.method, day, at: Date.now(), createdBy: by })
    .returning({ id: payments.id });
  const [p] = await db.select(paymentColumns).from(payments).innerJoin(patients, eq(patients.id, payments.patientId)).where(eq(payments.id, row.id));
  return toPayment(p);
}

export async function voidCharge(id: number): Promise<boolean> {
  const db = await getDb();
  const rows = await db.update(charges).set({ voidedAt: Date.now() }).where(and(eq(charges.id, id), isNull(charges.voidedAt))).returning({ id: charges.id });
  return rows.length > 0;
}

export async function voidPayment(id: number): Promise<boolean> {
  const db = await getDb();
  const rows = await db.update(payments).set({ voidedAt: Date.now() }).where(and(eq(payments.id, id), isNull(payments.voidedAt))).returning({ id: payments.id });
  return rows.length > 0;
}

// Between two days (from inclusive, to exclusive).
export async function moneyBetween(from: string, to: string): Promise<{ charges: Charge[]; payments: Payment[] }> {
  const db = await getDb();
  const [c, p] = await Promise.all([
    db.select(chargeColumns).from(charges).innerJoin(patients, eq(patients.id, charges.patientId)).where(and(gte(charges.day, from), lt(charges.day, to))).orderBy(desc(charges.at)),
    db.select(paymentColumns).from(payments).innerJoin(patients, eq(patients.id, payments.patientId)).where(and(gte(payments.day, from), lt(payments.day, to))).orderBy(desc(payments.at)),
  ]);
  return { charges: c.map(toCharge), payments: p.map(toPayment) };
}

export async function patientMoney(patientId: number): Promise<{ charges: Charge[]; payments: Payment[]; balance: number }> {
  const db = await getDb();
  const [c, p] = await Promise.all([
    db.select(chargeColumns).from(charges).innerJoin(patients, eq(patients.id, charges.patientId)).where(eq(charges.patientId, patientId)).orderBy(desc(charges.at)),
    db.select(paymentColumns).from(payments).innerJoin(patients, eq(patients.id, payments.patientId)).where(eq(payments.patientId, patientId)).orderBy(desc(payments.at)),
  ]);
  const list = { charges: c.map(toCharge), payments: p.map(toPayment) };
  const owed = list.charges.filter((x) => !x.voided).reduce((s, x) => s + x.amount - x.discount, 0);
  const paid = list.payments.filter((x) => !x.voided).reduce((s, x) => s + x.amount, 0);
  return { ...list, balance: owed - paid };
}

// Patients who owe money, most owed first.
export async function balancesOwed(limit = 100): Promise<{ patientId: number; name: string; fileNo: number; balance: number }[]> {
  const db = await getDb();
  const owed = sql<number>`COALESCE((SELECT SUM(${charges.amount} - ${charges.discount}) FROM ${charges} WHERE ${charges.patientId} = ${patients.id} AND ${charges.voidedAt} IS NULL), 0)
    - COALESCE((SELECT SUM(${payments.amount}) FROM ${payments} WHERE ${payments.patientId} = ${patients.id} AND ${payments.voidedAt} IS NULL), 0)`;
  const rows = await db
    .select({ patientId: patients.id, name: patients.name, fileNo: patients.fileNo, balance: owed })
    .from(patients)
    .where(sql`${owed} > 0`)
    .orderBy(desc(owed))
    .limit(limit);
  return rows.map((r) => ({ ...r, balance: Number(r.balance) }));
}

// ---- Expenses --------------------------------------------------------------

function toExpense(r: typeof expenses.$inferSelect): Expense {
  return { id: r.id, day: r.day, category: r.category, description: r.description, amount: r.amount, createdBy: r.createdBy };
}

export async function listExpenses(from: string, to: string): Promise<Expense[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(expenses)
    .where(and(gte(expenses.day, from), lt(expenses.day, to), isNull(expenses.deletedAt)))
    .orderBy(desc(expenses.day), desc(expenses.id));
  return rows.map(toExpense);
}

export async function expenseCategories(): Promise<string[]> {
  const db = await getDb();
  const rows = await db.selectDistinct({ c: expenses.category }).from(expenses).where(isNull(expenses.deletedAt)).orderBy(asc(expenses.category)).limit(100);
  return rows.map((r) => r.c).filter(Boolean);
}

export async function addExpense(input: z.infer<typeof expenseSchema>, by: string): Promise<Expense> {
  const db = await getDb();
  const [row] = await db
    .insert(expenses)
    .values({ ...input, createdBy: by, createdAt: Date.now() })
    .returning();
  return toExpense(row);
}

export async function deleteExpense(id: number): Promise<boolean> {
  const db = await getDb();
  const rows = await db.update(expenses).set({ deletedAt: Date.now() }).where(and(eq(expenses.id, id), isNull(expenses.deletedAt))).returning({ id: expenses.id });
  return rows.length > 0;
}
