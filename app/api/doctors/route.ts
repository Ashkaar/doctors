import type { NextRequest } from "next/server";
import { logActivity } from "@/lib/activity";
import { actorOf, badRequest, ok, parseBody, requireOwner, serverError } from "@/lib/api";
import { doctorSchema } from "@/lib/clinic";
import { countActiveDoctors, createDoctor } from "@/lib/doctorsDb";
import { hasFeature } from "@/lib/features";
import { getMessages } from "@/lib/i18n/server";
import { STARTER_DOCTORS } from "@/lib/plans";

// POST → a new doctor. Owner only. Without "several doctors" in the plan,
// only one can be active.
export async function POST(request: NextRequest) {
  const { viewer, error: authError } = await requireOwner();
  if (authError) return authError;
  const { data, error } = await parseBody(request, doctorSchema);
  if (error) return error;
  try {
    if (data.active && !(await hasFeature("manyDoctors")) && (await countActiveDoctors()) >= STARTER_DOCTORS) return badRequest((await getMessages()).doctors.limit);
    const doctor = await createDoctor(data);
    await logActivity(actorOf(viewer), "doctor-added", doctor.name);
    return ok({ doctor }, 201);
  } catch (err) {
    return serverError("add a doctor", err);
  }
}
