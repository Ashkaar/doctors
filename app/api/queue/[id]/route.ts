import type { NextRequest } from "next/server";
import { z } from "zod";
import { notFound, ok, parseBody, parseId, serverError } from "@/lib/api";
import { QUEUE_STATUSES } from "@/lib/clinic";
import { requireRecord } from "@/lib/guards";
import { getTicket, setTicketStatus } from "@/lib/scheduleDb";

const schema = z.object({ status: z.enum(QUEUE_STATUSES) });

// PATCH { status } → waiting, called, in the room, done, or left.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) return notFound();
  const { viewer, error: authError } = await requireRecord("queue");
  if (authError) return authError;
  const { data, error } = await parseBody(request, schema);
  if (error) return error;
  try {
    const ticket = await getTicket(id);
    if (!ticket || (viewer.ownPatientsOnly && ticket.doctorId !== viewer.doctorId)) return notFound();
    return ok({ ticket: await setTicketStatus(id, data.status) });
  } catch (err) {
    return serverError("change a queue turn", err);
  }
}
