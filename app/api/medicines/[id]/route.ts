import type { NextRequest } from "next/server";
import { badRequest, notFound, ok, parseBody, parseId, serverError } from "@/lib/api";
import { medicineSchema } from "@/lib/clinic";
import { requireRecord } from "@/lib/guards";
import { getMessages } from "@/lib/i18n/server";
import { deleteMedicine, medicineNameTaken, updateMedicine } from "@/lib/medicinesDb";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const id = parseId((await params).id);
  if (!id) return notFound();
  const { error: authError } = await requireRecord("medicines", "full", "prescriptions");
  if (authError) return authError;
  const { data, error } = await parseBody(request, medicineSchema);
  if (error) return error;
  try {
    if (await medicineNameTaken(data.name, id)) return badRequest((await getMessages()).medicines.taken);
    const medicine = await updateMedicine(id, data);
    return medicine ? ok({ medicine }) : notFound();
  } catch (err) {
    return serverError("change a medicine", err);
  }
}

// Prescriptions keep their own copy of the text, so deleting is safe.
export async function DELETE(_request: NextRequest, { params }: Params) {
  const id = parseId((await params).id);
  if (!id) return notFound();
  const { error } = await requireRecord("medicines", "full", "prescriptions");
  if (error) return error;
  try {
    return (await deleteMedicine(id)) ? ok({ ok: true }) : notFound();
  } catch (err) {
    return serverError("delete a medicine", err);
  }
}
