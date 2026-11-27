import type { NextRequest } from "next/server";
import { logActivity } from "@/lib/activity";
import { actorOf, notFound, ok, parseBody, parseId, serverError } from "@/lib/api";
import { requirePatient } from "@/lib/guards";
import { pregnancySchema } from "@/lib/specialties";
import { getPregnancy, savePregnancy } from "@/lib/specialtiesDb";

// PATCH (the whole record) → dates, history, status and outcome.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) return notFound();
  const current = await getPregnancy(id);
  if (!current) return notFound();
  const { viewer, error: authError } = await requirePatient(current.patientId, "full");
  if (authError) return authError;
  const { data, error } = await parseBody(request, pregnancySchema);
  if (error) return error;
  try {
    const pregnancy = await savePregnancy(current.patientId, data, id);
    await logActivity(actorOf(viewer), "pregnancy-changed", `patient ${current.patientId}`);
    return ok({ pregnancy });
  } catch (err) {
    return serverError("change a pregnancy", err);
  }
}
