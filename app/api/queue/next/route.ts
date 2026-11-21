import type { NextRequest } from "next/server";
import { z } from "zod";
import { badRequest, ok, parseBody, serverError } from "@/lib/api";
import { requireRecord } from "@/lib/guards";
import { callNext } from "@/lib/scheduleDb";
import { requestToday } from "@/lib/settingsDb";

const schema = z.object({ doctorId: z.number().int().positive() });

// POST { doctorId } → calls that doctor's next waiting patient.
export async function POST(request: NextRequest) {
  const { viewer, error: authError } = await requireRecord("queue");
  if (authError) return authError;
  const { data, error } = await parseBody(request, schema);
  if (error) return error;
  if (viewer.ownPatientsOnly && data.doctorId !== viewer.doctorId) return badRequest();
  try {
    const { day } = await requestToday();
    return ok({ ticket: await callNext(day, data.doctorId) });
  } catch (err) {
    return serverError("call the next patient", err);
  }
}
