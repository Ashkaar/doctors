import type { NextRequest } from "next/server";
import { logActivity } from "@/lib/activity";
import { actorOf, notFound, ok, parseBody, parseId, serverError } from "@/lib/api";
import { requirePatient } from "@/lib/guards";
import { vaccinationSchema } from "@/lib/specialties";
import { addVaccination } from "@/lib/specialtiesDb";

// POST { vaccine, givenOn, batch, note } → a vaccine given. Nurses too.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) return notFound();
  const { viewer, error: authError } = await requirePatient(id, "vitals");
  if (authError) return authError;
  const { data, error } = await parseBody(request, vaccinationSchema);
  if (error) return error;
  try {
    const vaccination = await addVaccination(id, data, actorOf(viewer));
    await logActivity(actorOf(viewer), "vaccine-recorded", `patient ${id}`);
    return ok({ vaccination }, 201);
  } catch (err) {
    return serverError("record a vaccine", err);
  }
}
