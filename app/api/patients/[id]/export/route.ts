import type { NextRequest } from "next/server";
import { logActivity } from "@/lib/activity";
import { actorOf, notFound, notInPlan, parseId, requireOwner } from "@/lib/api";
import { exportPatientJson } from "@/lib/exportDb";
import { hasFeature } from "@/lib/features";
import { patientName } from "@/lib/patientsDb";

// GET → one patient's whole record, files included, as JSON. Owner only.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) return notFound();
  const { viewer, error } = await requireOwner();
  if (error) return error;
  if (!(await hasFeature("export"))) return notInPlan();
  const found = await patientName(id);
  if (!found) return notFound();
  await logActivity(actorOf(viewer), "patient-exported", `#${found.fileNo}`);
  return new Response(exportPatientJson(id), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="patient-${found.fileNo}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
