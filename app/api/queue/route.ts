import type { NextRequest } from "next/server";
import { z } from "zod";
import { logActivity } from "@/lib/activity";
import { actorOf, badRequest, ok, parseBody, serverError } from "@/lib/api";
import { getDoctor } from "@/lib/doctorsDb";
import { requirePatient, requireRecord } from "@/lib/guards";
import { addToQueue, listQueue } from "@/lib/scheduleDb";
import { requestToday } from "@/lib/settingsDb";

// GET → today's queue (polled by the Queue screen).
export async function GET() {
  const { viewer, error } = await requireRecord("queue");
  if (error) return error;
  try {
    const { day } = await requestToday();
    const doctor = viewer.ownPatientsOnly ? (viewer.doctorId ?? -1) : undefined;
    return ok({ day, queue: await listQueue(day, doctor) });
  } catch (err) {
    return serverError("list the queue", err);
  }
}

const schema = z.object({ patientId: z.number().int().positive(), doctorId: z.number().int().positive() });

// POST { patientId, doctorId } → a walk-in gets the day's next number.
export async function POST(request: NextRequest) {
  const g = await requireRecord("queue");
  if (g.error) return g.error;
  const { data, error } = await parseBody(request, schema);
  if (error) return error;
  const p = await requirePatient(data.patientId);
  // A doctor who sees only their own patients books only for themselves.
  if (g.viewer.ownPatientsOnly ? data.doctorId !== g.viewer.doctorId : p.error) return p.error ?? badRequest();
  try {
    const doctor = await getDoctor(data.doctorId);
    if (!doctor || !doctor.active) return badRequest();
    const { day } = await requestToday();
    const ticket = await addToQueue({ day, ...data });
    await logActivity(actorOf(g.viewer), "queue-added", `#${ticket.number}`);
    return ok({ ticket }, 201);
  } catch (err) {
    return serverError("add to the queue", err);
  }
}
