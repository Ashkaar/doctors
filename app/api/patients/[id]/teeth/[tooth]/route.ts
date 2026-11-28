import type { NextRequest } from "next/server";
import { logActivity } from "@/lib/activity";
import { actorOf, notFound, ok, parseBody, parseId, serverError } from "@/lib/api";
import { requirePatient } from "@/lib/guards";
import { isTooth, toothStateSchema } from "@/lib/specialties";
import { saveTooth } from "@/lib/specialtiesDb";

// PUT { conditions, surfaces, note } → one tooth's state on the dental chart.
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string; tooth: string }> }) {
  const p = await params;
  const id = parseId(p.id);
  const tooth = Number(p.tooth);
  if (!id || !Number.isInteger(tooth) || !isTooth(tooth)) return notFound();
  const { viewer, error: authError } = await requirePatient(id, "full");
  if (authError) return authError;
  const { data, error } = await parseBody(request, toothStateSchema);
  if (error) return error;
  try {
    const state = await saveTooth(id, tooth, data);
    await logActivity(actorOf(viewer), "tooth-charted", `patient ${id}`);
    return ok({ tooth: state });
  } catch (err) {
    return serverError("chart a tooth", err);
  }
}
