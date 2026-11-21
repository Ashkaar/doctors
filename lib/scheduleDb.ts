import "server-only";
import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import type { z } from "zod";
import type { Appointment, AppointmentStatus, appointmentSchema, QueueStatus, QueueTicket, ScreenState } from "./clinic";
import { APPOINTMENT_STATUSES, QUEUE_STATUSES } from "./clinic";
import { getDb } from "./db";
import { appointments, doctors, patients, queue } from "./db/schema";

// Appointments (booked ahead) and the day's queue (turns for patients who
// are here: arrived appointments and walk-ins).

const asAppointmentStatus = (s: string): AppointmentStatus => (APPOINTMENT_STATUSES.includes(s as AppointmentStatus) ? (s as AppointmentStatus) : "booked");
const asQueueStatus = (s: string): QueueStatus => (QUEUE_STATUSES.includes(s as QueueStatus) ? (s as QueueStatus) : "waiting");

const appointmentColumns = {
  id: appointments.id,
  patientId: appointments.patientId,
  patientName: patients.name,
  fileNo: patients.fileNo,
  phone: patients.phone,
  doctorId: appointments.doctorId,
  day: appointments.day,
  startMin: appointments.startMin,
  durationMin: appointments.durationMin,
  status: appointments.status,
  reason: appointments.reason,
};

type AppointmentRow = { [K in keyof typeof appointmentColumns]: unknown };
function toAppointment(r: AppointmentRow): Appointment {
  return {
    id: Number(r.id),
    patientId: Number(r.patientId),
    patientName: String(r.patientName ?? ""),
    fileNo: Number(r.fileNo ?? 0),
    phone: String(r.phone ?? ""),
    doctorId: Number(r.doctorId),
    day: String(r.day),
    startMin: Number(r.startMin),
    durationMin: Number(r.durationMin),
    status: asAppointmentStatus(String(r.status)),
    reason: String(r.reason ?? ""),
  };
}

// One day's appointments, optionally for one doctor.
export async function listAppointments(day: string, doctorId?: number): Promise<Appointment[]> {
  const db = await getDb();
  const rows = await db
    .select(appointmentColumns)
    .from(appointments)
    .innerJoin(patients, eq(patients.id, appointments.patientId))
    .where(and(eq(appointments.day, day), doctorId ? eq(appointments.doctorId, doctorId) : undefined))
    .orderBy(asc(appointments.startMin), asc(appointments.id));
  return rows.map(toAppointment);
}

export async function patientAppointments(patientId: number): Promise<Appointment[]> {
  const db = await getDb();
  const rows = await db
    .select(appointmentColumns)
    .from(appointments)
    .innerJoin(patients, eq(patients.id, appointments.patientId))
    .where(eq(appointments.patientId, patientId))
    .orderBy(desc(appointments.day), desc(appointments.startMin))
    .limit(100);
  return rows.map(toAppointment);
}

export async function getAppointment(id: number): Promise<Appointment | null> {
  const db = await getDb();
  const [row] = await db.select(appointmentColumns).from(appointments).innerJoin(patients, eq(patients.id, appointments.patientId)).where(eq(appointments.id, id));
  return row ? toAppointment(row) : null;
}

// True when the doctor already has a live appointment overlapping this one.
export async function overlaps(input: { doctorId: number; day: string; startMin: number; durationMin: number }, exceptId = 0): Promise<boolean> {
  const db = await getDb();
  const rows = await db
    .select({ id: appointments.id })
    .from(appointments)
    .where(
      and(
        eq(appointments.doctorId, input.doctorId),
        eq(appointments.day, input.day),
        ne(appointments.id, exceptId),
        inArray(appointments.status, ["booked", "arrived"]),
        sql`${appointments.startMin} < ${input.startMin + input.durationMin}`,
        sql`${appointments.startMin} + ${appointments.durationMin} > ${input.startMin}`,
      ),
    )
    .limit(1);
  return rows.length > 0;
}

export async function createAppointment(input: z.infer<typeof appointmentSchema>, by: string): Promise<Appointment> {
  const db = await getDb();
  const now = Date.now();
  const [row] = await db
    .insert(appointments)
    .values({ ...input, status: "booked", createdBy: by, createdAt: now, updatedAt: now })
    .returning({ id: appointments.id });
  return (await getAppointment(row.id))!;
}

export async function updateAppointment(id: number, input: z.infer<typeof appointmentSchema>): Promise<Appointment | null> {
  const db = await getDb();
  const rows = await db
    .update(appointments)
    .set({ ...input, updatedAt: Date.now() })
    .where(eq(appointments.id, id))
    .returning({ id: appointments.id });
  return rows.length ? getAppointment(id) : null;
}

export async function setAppointmentStatus(id: number, status: AppointmentStatus): Promise<Appointment | null> {
  const db = await getDb();
  const rows = await db.update(appointments).set({ status, updatedAt: Date.now() }).where(eq(appointments.id, id)).returning({ id: appointments.id });
  return rows.length ? getAppointment(id) : null;
}

// ---- Queue -----------------------------------------------------------------

const ticketColumns = {
  id: queue.id,
  day: queue.day,
  number: queue.number,
  patientId: queue.patientId,
  patientName: patients.name,
  fileNo: patients.fileNo,
  doctorId: queue.doctorId,
  appointmentId: queue.appointmentId,
  visitId: queue.visitId,
  status: queue.status,
  calledAt: queue.calledAt,
  createdAt: queue.createdAt,
};

type TicketRow = { [K in keyof typeof ticketColumns]: unknown };
function toTicket(r: TicketRow): QueueTicket {
  return {
    id: Number(r.id),
    day: String(r.day),
    number: Number(r.number),
    patientId: Number(r.patientId),
    patientName: String(r.patientName ?? ""),
    fileNo: Number(r.fileNo ?? 0),
    doctorId: Number(r.doctorId),
    appointmentId: r.appointmentId == null ? null : Number(r.appointmentId),
    visitId: r.visitId == null ? null : Number(r.visitId),
    status: asQueueStatus(String(r.status)),
    calledAt: r.calledAt == null ? null : Number(r.calledAt),
    createdAt: Number(r.createdAt),
  };
}

export async function listQueue(day: string, doctorId?: number): Promise<QueueTicket[]> {
  const db = await getDb();
  const rows = await db
    .select(ticketColumns)
    .from(queue)
    .innerJoin(patients, eq(patients.id, queue.patientId))
    .where(and(eq(queue.day, day), doctorId ? eq(queue.doctorId, doctorId) : undefined))
    .orderBy(asc(queue.number));
  return rows.map(toTicket);
}

export async function getTicket(id: number): Promise<QueueTicket | null> {
  const db = await getDb();
  const [row] = await db.select(ticketColumns).from(queue).innerJoin(patients, eq(patients.id, queue.patientId)).where(eq(queue.id, id));
  return row ? toTicket(row) : null;
}

// Gives the patient the day's next number. An appointment already in the
// queue keeps its turn.
export async function addToQueue(input: { day: string; patientId: number; doctorId: number; appointmentId?: number | null }): Promise<QueueTicket> {
  const db = await getDb();
  if (input.appointmentId) {
    const [existing] = await db.select({ id: queue.id }).from(queue).where(eq(queue.appointmentId, input.appointmentId));
    if (existing) return (await getTicket(existing.id))!;
  }
  const now = Date.now();
  for (let attempt = 0; ; attempt++) {
    try {
      const [row] = await db
        .insert(queue)
        .values({
          day: input.day,
          number: sql`(SELECT COALESCE(MAX(${queue.number}), 0) + 1 FROM ${queue} WHERE ${queue.day} = ${input.day})`,
          patientId: input.patientId,
          doctorId: input.doctorId,
          appointmentId: input.appointmentId ?? null,
          status: "waiting",
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: queue.id });
      if (input.appointmentId) await setAppointmentStatus(input.appointmentId, "arrived");
      return (await getTicket(row.id))!;
    } catch (err) {
      if (attempt < 3 && String(err).includes("UNIQUE")) continue;
      throw err;
    }
  }
}

export async function setTicketStatus(id: number, status: QueueStatus): Promise<QueueTicket | null> {
  const db = await getDb();
  const now = Date.now();
  const set: Partial<typeof queue.$inferInsert> = { status, updatedAt: now };
  if (status === "called") set.calledAt = now;
  const rows = await db.update(queue).set(set).where(eq(queue.id, id)).returning({ id: queue.id, appointmentId: queue.appointmentId });
  if (!rows.length) return null;
  if (rows[0].appointmentId && (status === "done" || status === "left")) await setAppointmentStatus(rows[0].appointmentId, status === "done" ? "done" : "noShow");
  return getTicket(id);
}

export async function linkTicketVisit(id: number, visitId: number): Promise<void> {
  const db = await getDb();
  const now = Date.now();
  // Taken straight in counts as called, for the waiting-room screen.
  await db
    .update(queue)
    .set({ visitId, status: "inRoom", calledAt: sql`COALESCE(${queue.calledAt}, ${now})`, updatedAt: now })
    .where(eq(queue.id, id));
}

// The doctor's next waiting patient, called in.
export async function callNext(day: string, doctorId: number): Promise<QueueTicket | null> {
  const db = await getDb();
  const [next] = await db
    .select({ id: queue.id })
    .from(queue)
    .where(and(eq(queue.day, day), eq(queue.doctorId, doctorId), eq(queue.status, "waiting")))
    .orderBy(asc(queue.number))
    .limit(1);
  return next ? setTicketStatus(next.id, "called") : null;
}

// The waiting-room screen: the latest calls (numbers and doctors only).
export async function screenState(day: string, clinic: string): Promise<ScreenState> {
  const db = await getDb();
  const calls = await db
    .select({ number: queue.number, doctor: doctors.name, room: doctors.room, calledAt: queue.calledAt })
    .from(queue)
    .innerJoin(doctors, eq(doctors.id, queue.doctorId))
    .where(and(eq(queue.day, day), inArray(queue.status, ["called", "inRoom"])))
    .orderBy(desc(queue.calledAt))
    .limit(6);
  const [waiting] = await db
    .select({ n: sql<number>`count(*)` })
    .from(queue)
    .where(and(eq(queue.day, day), eq(queue.status, "waiting")));
  return {
    clinic,
    calls: calls.map((c) => ({ number: c.number, doctor: c.doctor, room: c.room, calledAt: Number(c.calledAt ?? 0) })),
    waiting: Number(waiting?.n ?? 0),
  };
}
