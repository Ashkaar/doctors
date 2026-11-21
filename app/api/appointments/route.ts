import type { NextRequest } from "next/server";
import { logActivity } from "@/lib/activity";
import { actorOf, badRequest, ok, parseBody, serverError } from "@/lib/api";
import { appointmentSchema, daySchema } from "@/lib/clinic";
import { getDoctor } from "@/lib/doctorsDb";
import { requirePatient, requireRecord } from "@/lib/guards";
import { getMessages } from "@/lib/i18n/server";
import { createAppointment, listAppointments, overlaps } from "@/lib/scheduleDb";

// GET ?day=YYYY-MM-DD&doctor= → that day's appointments.
export async function GET(request: NextRequest) {
  const { viewer, error } = await requireRecord("appointments");
  if (error) return error;
  const day = daySchema.safeParse(request.nextUrl.searchParams.get("day"));
  if (!day.success) return badRequest();
  try {
    const doctor = viewer.ownPatientsOnly ? (viewer.doctorId ?? -1) : Number(request.nextUrl.searchParams.get("doctor")) || undefined;
    return ok({ appointments: await listAppointments(day.data, doctor) });
  } catch (err) {
    return serverError("list appointments", err);
  }
}

// POST { patientId, doctorId, day, startMin, durationMin, reason } → books.
export async function POST(request: NextRequest) {
  const g = await requireRecord("appointments");
  if (g.error) return g.error;
  const { data, error } = await parseBody(request, appointmentSchema);
  if (error) return error;
  const p = await requirePatient(data.patientId);
  // A doctor who sees only their own patients books only for themselves.
  if (g.viewer.ownPatientsOnly ? data.doctorId !== g.viewer.doctorId : p.error) return p.error ?? badRequest();
  try {
    const doctor = await getDoctor(data.doctorId);
    if (!doctor || !doctor.active) return badRequest();
    if (await overlaps(data)) return badRequest((await getMessages()).appointments.overlap);
    const appointment = await createAppointment(data, actorOf(g.viewer));
    await logActivity(actorOf(g.viewer), "appointment-booked", `appointment ${appointment.id}`);
    return ok({ appointment }, 201);
  } catch (err) {
    return serverError("book an appointment", err);
  }
}
