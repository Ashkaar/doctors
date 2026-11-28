import type { NextRequest } from "next/server";
import { notFound, ok, parseId, serverError } from "@/lib/api";
import { requirePatient } from "@/lib/guards";
import { deleteVaccination, getVaccination } from "@/lib/specialtiesDb";

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) return notFound();
  try {
    const v = await getVaccination(id);
    if (!v) return notFound();
    const { error } = await requirePatient(v.patientId, "vitals");
    if (error) return error;
    await deleteVaccination(id);
    return ok({ ok: true });
  } catch (err) {
    return serverError("delete a vaccine", err);
  }
}
