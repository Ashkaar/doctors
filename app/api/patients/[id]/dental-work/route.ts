import type { NextRequest } from "next/server";
import { logActivity } from "@/lib/activity";
import { actorOf, badRequest, notFound, ok, parseBody, parseId, serverError } from "@/lib/api";
import { requirePatient } from "@/lib/guards";
import { dentalWorkSchema } from "@/lib/specialties";
import { addWork } from "@/lib/specialtiesDb";
import { visitPatientId } from "@/lib/visitsDb";

// POST { tooth, procedure, surfaces, fee, note, visitId? } → planned dental work.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) return notFound();
  const { viewer, error: authError } = await requirePatient(id, "full");
  if (authError) return authError;
  const { data, error } = await parseBody(request, dentalWorkSchema);
  if (error) return error;
  try {
    if (data.visitId && (await visitPatientId(data.visitId)) !== id) return badRequest();
    const work = await addWork(id, data, actorOf(viewer));
    await logActivity(actorOf(viewer), "dental-planned", `patient ${id}`);
    return ok({ work }, 201);
  } catch (err) {
    return serverError("plan dental work", err);
  }
}
