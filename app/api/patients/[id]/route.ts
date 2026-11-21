import type { NextRequest } from "next/server";
import { logActivity } from "@/lib/activity";
import { actorOf, notFound, ok, parseBody, parseId, requireOwner, serverError } from "@/lib/api";
import { patientSchema } from "@/lib/clinic";
import { requirePatient } from "@/lib/guards";
import { deletePatient, getPatient, patientName, updatePatient } from "@/lib/patientsDb";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const id = parseId((await params).id);
  if (!id) return notFound();
  const { viewer, error } = await requirePatient(id);
  if (error) return error;
  try {
    const patient = await getPatient(viewer, id);
    return patient ? ok({ patient }) : notFound();
  } catch (err) {
    return serverError("read a patient", err);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const id = parseId((await params).id);
  if (!id) return notFound();
  const { viewer, error: authError } = await requirePatient(id);
  if (authError) return authError;
  const { data, error } = await parseBody(request, patientSchema);
  if (error) return error;
  try {
    const patient = await updatePatient(viewer, id, data);
    if (!patient) return notFound();
    await logActivity(actorOf(viewer), "patient-changed", `#${patient.fileNo}`);
    return ok({ patient });
  } catch (err) {
    return serverError("change a patient", err);
  }
}

// DELETE → removes the patient and every record about them. Owner only.
export async function DELETE(_request: NextRequest, { params }: Params) {
  const id = parseId((await params).id);
  if (!id) return notFound();
  const { viewer, error } = await requireOwner();
  if (error) return error;
  try {
    const found = await patientName(id);
    if (!found) return notFound();
    await deletePatient(id);
    await logActivity(actorOf(viewer), "patient-deleted", `#${found.fileNo}`);
    return ok({ ok: true });
  } catch (err) {
    return serverError("delete a patient", err);
  }
}
