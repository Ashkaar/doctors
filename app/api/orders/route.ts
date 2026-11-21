import type { NextRequest } from "next/server";
import { z } from "zod";
import { logActivity } from "@/lib/activity";
import { actorOf, badRequest, ok, parseBody, serverError } from "@/lib/api";
import { orderSchema } from "@/lib/clinic";
import { requirePatient } from "@/lib/guards";
import { createOrder, visitPatientId } from "@/lib/visitsDb";

const schema = orderSchema.extend({ patientId: z.number().int().positive(), visitId: z.number().int().positive().nullable().default(null) });

// POST { patientId, visitId?, kind, name } → a lab test or imaging asked for.
export async function POST(request: NextRequest) {
  const { data, error } = await parseBody(request, schema);
  if (error) return error;
  const { viewer, error: authError } = await requirePatient(data.patientId, "full", "files");
  if (authError) return authError;
  try {
    if (data.visitId && (await visitPatientId(data.visitId)) !== data.patientId) return badRequest();
    const order = await createOrder(data);
    await logActivity(actorOf(viewer), "order-added", `patient ${data.patientId}`);
    return ok({ order }, 201);
  } catch (err) {
    return serverError("add an order", err);
  }
}
