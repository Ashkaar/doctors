import "server-only";
import type { NextResponse } from "next/server";
import { forbidden, notFound, notInPlan, requireSection } from "./api";
import { hasFeature } from "./features";
import { canSeePatient } from "./patientsDb";
import type { Feature } from "./plans";
import type { Clinical, Section, Viewer } from "./sections";
import { visitPatientId } from "./visitsDb";

// Guards for patient records, on top of lib/api.ts. Each returns the viewer,
// or the response to send instead.

type Result = { viewer: Viewer; error: null } | { viewer: null; error: NextResponse };

const rank: Record<Clinical, number> = { none: 0, vitals: 1, full: 2 };

// Signed in with `section`, at least `clinical`, and the plan has `feature`.
export async function requireRecord(section: Section, clinical: Clinical = "none", feature?: Feature): Promise<Result> {
  const g = await requireSection(section);
  if (g.error) return g;
  if (rank[g.viewer.clinical] < rank[clinical]) return { viewer: null, error: await forbidden() };
  if (feature && !(await hasFeature(feature))) return { viewer: null, error: await notInPlan() };
  return g;
}

// …and the patient is one this login may open.
export async function requirePatient(patientId: number, clinical: Clinical = "none", feature?: Feature): Promise<Result> {
  const g = await requireRecord("patients", clinical, feature);
  if (g.error) return g;
  if (!(await canSeePatient(g.viewer, patientId))) return { viewer: null, error: await notFound() };
  return g;
}

export async function requireVisit(visitId: number, clinical: Clinical): Promise<(Result & { patientId: number }) | { viewer: null; error: NextResponse; patientId: 0 }> {
  const patientId = await visitPatientId(visitId);
  if (!patientId) return { viewer: null, error: await notFound(), patientId: 0 };
  const g = await requirePatient(patientId, clinical);
  return g.error ? { ...g, patientId: 0 } : { ...g, patientId };
}
