import type { NextRequest } from "next/server";
import { z } from "zod";
import { logActivity } from "@/lib/activity";
import { actorOf, badRequest, notFound, ok, parseBody, parseId, serverError } from "@/lib/api";
import { APPOINTMENT_STATUSES, appointmentSchema } from "@/lib/clinic";
import { requireRecord } from "@/lib/guards";
import { getMessages } from "@/lib/i18n/server";
import { addToQueue, getAppointment, overlaps, setAppointmentStatus, updateAppointment } from "@/lib/scheduleDb";

const schema = z.union([
  z.object({ status: z.enum(APPOINTMENT_STATUSES) }),
  appointmentSchema,
]);

// PATCH { status } → arrived (joins the queue), done, cancelled, no show.
// PATCH { patientId, doctorId, day, startMin, … } → moves the appointment.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) return notFound();
  const { viewer, error: authError } = await requireRecord("appointments");
  if (authError) return authError;
  const { data, error } = await parseBody(request, schema);
  if (error) return error;
  try {
    const current = await getAppointment(id);
    if (!current) return notFound();
    if (viewer.ownPatientsOnly && current.doctorId !== viewer.doctorId) return notFound();
    if ("status" in data) {
      if (data.status === "arrived") {
        const ticket = await addToQueue({ day: current.day, patientId: current.patientId, doctorId: current.doctorId, appointmentId: id });
        return ok({ appointment: await getAppointment(id), ticket });
      }
      const appointment = await setAppointmentStatus(id, data.status);
      await logActivity(actorOf(viewer), `appointment-${data.status}`, `appointment ${id}`);
      return ok({ appointment });
    }
    if (data.patientId !== current.patientId) return badRequest();
    if (await overlaps(data, id)) return badRequest((await getMessages()).appointments.overlap);
    const appointment = await updateAppointment(id, data);
    await logActivity(actorOf(viewer), "appointment-moved", `appointment ${id}`);
    return ok({ appointment });
  } catch (err) {
    return serverError("change an appointment", err);
  }
}
