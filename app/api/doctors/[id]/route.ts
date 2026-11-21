import type { NextRequest } from "next/server";
import { logActivity } from "@/lib/activity";
import { actorOf, badRequest, notFound, ok, parseBody, parseId, requireOwner, serverError } from "@/lib/api";
import { doctorSchema } from "@/lib/clinic";
import { countActiveDoctors, updateDoctor } from "@/lib/doctorsDb";
import { hasFeature } from "@/lib/features";
import { getMessages } from "@/lib/i18n/server";
import { STARTER_DOCTORS } from "@/lib/plans";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) return notFound();
  const { viewer, error: authError } = await requireOwner();
  if (authError) return authError;
  const { data, error } = await parseBody(request, doctorSchema);
  if (error) return error;
  try {
    if (data.active && !(await hasFeature("manyDoctors")) && (await countActiveDoctors(id)) >= STARTER_DOCTORS) return badRequest((await getMessages()).doctors.limit);
    const doctor = await updateDoctor(id, data);
    if (!doctor) return notFound();
    await logActivity(actorOf(viewer), "doctor-changed", doctor.name);
    return ok({ doctor });
  } catch (err) {
    return serverError("change a doctor", err);
  }
}
