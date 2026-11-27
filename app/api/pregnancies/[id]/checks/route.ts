import type { NextRequest } from "next/server";
import { logActivity } from "@/lib/activity";
import { actorOf, badRequest, notFound, ok, parseBody, parseId, serverError } from "@/lib/api";
import { requirePatient } from "@/lib/guards";
import { ancCheckSchema } from "@/lib/specialties";
import { addCheck, getPregnancy } from "@/lib/specialtiesDb";
import { visitPatientId } from "@/lib/visitsDb";

// POST { day, weightG, bpSys, bpDia, fhr, fundalCm, presentation, notes } → an antenatal check.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) return notFound();
  const pregnancy = await getPregnancy(id);
  if (!pregnancy) return notFound();
  const { viewer, error: authError } = await requirePatient(pregnancy.patientId, "full");
  if (authError) return authError;
  const { data, error } = await parseBody(request, ancCheckSchema);
  if (error) return error;
  try {
    if (data.visitId && (await visitPatientId(data.visitId)) !== pregnancy.patientId) return badRequest();
    const check = await addCheck(pregnancy, data);
    await logActivity(actorOf(viewer), "anc-check", `patient ${pregnancy.patientId}`);
    return ok({ check }, 201);
  } catch (err) {
    return serverError("add an antenatal check", err);
  }
}
