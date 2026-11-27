import "server-only";
import { and, asc, eq, ne } from "drizzle-orm";
import type { z } from "zod";
import { parseSchedule, type Doctor, type doctorSchema } from "./clinic";
import { getDb } from "./db";
import { doctors } from "./db/schema";

function toDoctor(r: typeof doctors.$inferSelect): Doctor {
  return {
    id: r.id,
    name: r.name,
    specialty: r.specialty,
    phone: r.phone,
    licence: r.licence,
    room: r.room,
    staffId: r.staffId,
    shareBp: r.shareBp,
    slotMinutes: r.slotMinutes,
    active: r.active === 1,
    schedule: parseSchedule(r.schedule),
  };
}

export async function listDoctors(activeOnly = false): Promise<Doctor[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(doctors)
    .where(activeOnly ? eq(doctors.active, 1) : undefined)
    .orderBy(asc(doctors.name));
  return rows.map(toDoctor);
}

export async function getDoctor(id: number): Promise<Doctor | null> {
  const db = await getDb();
  const [row] = await db.select().from(doctors).where(eq(doctors.id, id));
  return row ? toDoctor(row) : null;
}

export async function doctorIdForStaff(staffId: number): Promise<number | null> {
  const db = await getDb();
  const [row] = await db
    .select({ id: doctors.id })
    .from(doctors)
    .where(and(eq(doctors.staffId, staffId), eq(doctors.active, 1)));
  return row?.id ?? null;
}

export async function countActiveDoctors(exceptId = 0): Promise<number> {
  const db = await getDb();
  const rows = await db
    .select({ id: doctors.id })
    .from(doctors)
    .where(and(eq(doctors.active, 1), ne(doctors.id, exceptId)));
  return rows.length;
}

type DoctorInput = z.infer<typeof doctorSchema>;

// The row to write: the schedule is kept as JSON, and left alone when not sent.
function toRow({ schedule, active, ...rest }: DoctorInput) {
  return { ...rest, active: active ? 1 : 0, ...(schedule ? { schedule: JSON.stringify(schedule) } : {}) };
}

// A staff login is linked to at most one doctor.
async function unlinkStaff(staffId: number | null, exceptId: number) {
  if (!staffId) return;
  const db = await getDb();
  await db
    .update(doctors)
    .set({ staffId: null })
    .where(and(eq(doctors.staffId, staffId), ne(doctors.id, exceptId)));
}

export async function createDoctor(input: DoctorInput): Promise<Doctor> {
  const db = await getDb();
  const [row] = await db
    .insert(doctors)
    .values({ ...toRow(input), createdAt: Date.now() })
    .returning();
  await unlinkStaff(row.staffId, row.id);
  return toDoctor(row);
}

export async function updateDoctor(id: number, input: DoctorInput): Promise<Doctor | null> {
  const db = await getDb();
  const [row] = await db
    .update(doctors)
    .set(toRow(input))
    .where(eq(doctors.id, id))
    .returning();
  if (!row) return null;
  await unlinkStaff(row.staffId, row.id);
  return toDoctor(row);
}
