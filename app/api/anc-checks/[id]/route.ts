import type { NextRequest } from "next/server";
import { notFound, ok, parseId, serverError } from "@/lib/api";
import { requirePatient } from "@/lib/guards";
import { deleteCheck, getCheck } from "@/lib/specialtiesDb";

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) return notFound();
  try {
    const check = await getCheck(id);
    if (!check) return notFound();
    const { error } = await requirePatient(check.patientId, "full");
    if (error) return error;
    await deleteCheck(id);
    return ok({ ok: true });
  } catch (err) {
    return serverError("delete an antenatal check", err);
  }
}
