import type { NextRequest } from "next/server";
import { logActivity } from "@/lib/activity";
import { actorOf, ok, parseBody, serverError } from "@/lib/api";
import { patientSchema } from "@/lib/clinic";
import { requireRecord } from "@/lib/guards";
import { createPatient, searchPatients } from "@/lib/patientsDb";

// GET ?q= → patients matching a name, phone or file number (newest first).
// The search text stays in this request; it is never logged.
export async function GET(request: NextRequest) {
  const { viewer, error } = await requireRecord("patients");
  if (error) return error;
  try {
    return ok({ patients: await searchPatients(viewer, request.nextUrl.searchParams.get("q") ?? "", 30) });
  } catch (err) {
    return serverError("search patients", err);
  }
}

// POST { name, phone, … } → a new patient file.
export async function POST(request: NextRequest) {
  const { viewer, error: authError } = await requireRecord("patients");
  if (authError) return authError;
  const { data, error } = await parseBody(request, patientSchema);
  if (error) return error;
  try {
    const patient = await createPatient(viewer, data);
    await logActivity(actorOf(viewer), "patient-added", `#${patient.fileNo}`);
    return ok({ patient }, 201);
  } catch (err) {
    return serverError("add a patient", err);
  }
}
