import type { NextRequest } from "next/server";
import { logActivity } from "@/lib/activity";
import { actorOf, notFound, ok, parseBody, parseId, serverError } from "@/lib/api";
import { visitSaveSchema } from "@/lib/clinic";
import { hasFeature } from "@/lib/features";
import { requireVisit } from "@/lib/guards";
import { getVisit, saveVisit } from "@/lib/visitsDb";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const id = parseId((await params).id);
  if (!id) return notFound();
  const { viewer, error } = await requireVisit(id, "vitals");
  if (error) return error;
  try {
    const visit = await getVisit(id, viewer.clinical);
    return visit ? ok({ visit }) : notFound();
  } catch (err) {
    return serverError("read a visit", err);
  }
}

// PATCH { notes?, vitals?, items?, doctorId? } → saves the visit. Nurses
// save vitals only; the prescription needs a plan with prescriptions.
export async function PATCH(request: NextRequest, { params }: Params) {
  const id = parseId((await params).id);
  if (!id) return notFound();
  const { viewer, error: authError } = await requireVisit(id, "vitals");
  if (authError) return authError;
  const { data, error } = await parseBody(request, visitSaveSchema);
  if (error) return error;
  try {
    const saved = await saveVisit(id, data, viewer.clinical, await hasFeature("prescriptions"));
    if (!saved) return notFound();
    await logActivity(actorOf(viewer), "visit-saved", `visit ${id}`);
    return ok({ visit: await getVisit(id, viewer.clinical) });
  } catch (err) {
    return serverError("save a visit", err);
  }
}
