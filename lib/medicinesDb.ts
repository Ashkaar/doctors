import "server-only";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import type { z } from "zod";
import type { Medicine, medicineSchema } from "./clinic";
import { getDb } from "./db";
import { medicines } from "./db/schema";

function toMedicine(r: typeof medicines.$inferSelect): Medicine {
  return { id: r.id, name: r.name, form: r.form, dose: r.dose, frequency: r.frequency, duration: r.duration, active: r.active === 1 };
}

export async function listMedicines(activeOnly = false): Promise<Medicine[]> {
  const db = await getDb();
  const rows = await db.select().from(medicines).where(activeOnly ? eq(medicines.active, 1) : undefined).orderBy(asc(medicines.name));
  return rows.map(toMedicine);
}

export async function medicineNameTaken(name: string, exceptId = 0): Promise<boolean> {
  const db = await getDb();
  const rows = await db
    .select({ id: medicines.id })
    .from(medicines)
    .where(and(sql`${medicines.name} = ${name} COLLATE NOCASE`, ne(medicines.id, exceptId)));
  return rows.length > 0;
}

type Input = z.infer<typeof medicineSchema>;

export async function createMedicine(input: Input): Promise<Medicine> {
  const db = await getDb();
  const [row] = await db
    .insert(medicines)
    .values({ ...input, active: input.active ? 1 : 0, createdAt: Date.now() })
    .returning();
  return toMedicine(row);
}

export async function updateMedicine(id: number, input: Input): Promise<Medicine | null> {
  const db = await getDb();
  const [row] = await db
    .update(medicines)
    .set({ ...input, active: input.active ? 1 : 0 })
    .where(eq(medicines.id, id))
    .returning();
  return row ? toMedicine(row) : null;
}

export async function deleteMedicine(id: number): Promise<boolean> {
  const db = await getDb();
  const rows = await db.delete(medicines).where(eq(medicines.id, id)).returning({ id: medicines.id });
  return rows.length > 0;
}
