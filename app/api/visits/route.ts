import type { NextRequest } from "next/server";
import { z } from "zod";
import { logActivity } from "@/lib/activity";
import { actorOf, badRequest, ok, parseBody, serverError } from "@/lib/api";
import { getDoctor } from "@/lib/doctorsDb";
import { requirePatient } from "@/lib/guards";
import { getTicket, linkTicketVisit } from "@/lib/scheduleDb";
import { requestToday } from "@/lib/settingsDb";
import { createVisit } from "@/lib/visitsDb";

const schema = z.object({ patientId: z.number().int().positive(), doctorId: z.number().int().positive().optional(), ticketId: z.number().int().positive().optional() });

// POST { patientId, doctorId?, ticketId? } → opens a new visit. From the
// queue, the turn moves to "in the room". Nurse (vitals) and up.
export async function POST(request: NextRequest) {
  const { data, error } = await parseBody(request, schema);
  if (error) return error;
  const { viewer, error: authError } = await requirePatient(data.patientId, "vitals");
  if (authError) return authError;
  try {
    const ticket = data.ticketId ? await getTicket(data.ticketId) : null;
    if (data.ticketId && (!ticket || ticket.patientId !== data.patientId)) return badRequest();
    const doctorId = ticket?.doctorId ?? data.doctorId ?? viewer.doctorId;
    if (!doctorId || !(await getDoctor(doctorId))) return badRequest();
    if (ticket?.visitId) return ok({ id: ticket.visitId });
    const { day } = await requestToday();
    const id = await createVisit({ patientId: data.patientId, doctorId, day, by: actorOf(viewer) });
    if (ticket) await linkTicketVisit(ticket.id, id);
    await logActivity(actorOf(viewer), "visit-opened", `visit ${id}`);
    return ok({ id }, 201);
  } catch (err) {
    return serverError("open a visit", err);
  }
}
