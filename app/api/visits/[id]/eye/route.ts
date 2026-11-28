import type { NextRequest } from "next/server";
import { logActivity } from "@/lib/activity";
import { actorOf, notFound, ok, parseBody, parseId, serverError } from "@/lib/api";
import { requireVisit } from "@/lib/guards";
import { eyeExamSchema } from "@/lib/specialties";
import { saveEyeExam } from "@/lib/specialtiesDb";

// PUT { od, os, pd, notes } → the visit's eye exam.
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) return notFound();
  const g = await requireVisit(id, "full");
  if (g.error) return g.error;
  const { data, error } = await parseBody(request, eyeExamSchema);
  if (error) return error;
  try {
    await saveEyeExam(g.patientId, id, data);
    await logActivity(actorOf(g.viewer), "eye-exam-saved", `visit ${id}`);
    return ok({ exam: data });
  } catch (err) {
    return serverError("save an eye exam", err);
  }
}
