import type { NextRequest } from "next/server";
import { logActivity } from "@/lib/activity";
import { actorOf, notFound, ok, parseBody, parseId, serverError } from "@/lib/api";
import { requirePatient } from "@/lib/guards";
import { pregnancySchema } from "@/lib/specialties";
import { savePregnancy } from "@/lib/specialtiesDb";

// POST { lmp, edd?, gravida, para, … } → a new pregnancy record.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) return notFound();
  const { viewer, error: authError } = await requirePatient(id, "full");
  if (authError) return authError;
  const { data, error } = await parseBody(request, pregnancySchema);
  if (error) return error;
  try {
    const pregnancy = await savePregnancy(id, data);
    await logActivity(actorOf(viewer), "pregnancy-added", `patient ${id}`);
    return ok({ pregnancy }, 201);
  } catch (err) {
    return serverError("add a pregnancy", err);
  }
}
