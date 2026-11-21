import type { NextRequest } from "next/server";
import { badRequest, ok, parseBody, serverError } from "@/lib/api";
import { medicineSchema } from "@/lib/clinic";
import { requireRecord } from "@/lib/guards";
import { getMessages } from "@/lib/i18n/server";
import { createMedicine, listMedicines, medicineNameTaken } from "@/lib/medicinesDb";

// GET → the saved medicines (for writing prescriptions).
export async function GET() {
  const { error } = await requireRecord("patients", "full", "prescriptions");
  if (error) return error;
  try {
    return ok({ medicines: await listMedicines(true) });
  } catch (err) {
    return serverError("list medicines", err);
  }
}

// POST → saves a medicine to the list. Doctors (and the owner).
export async function POST(request: NextRequest) {
  const { error: authError } = await requireRecord("medicines", "full", "prescriptions");
  if (authError) return authError;
  const { data, error } = await parseBody(request, medicineSchema);
  if (error) return error;
  try {
    if (await medicineNameTaken(data.name)) return badRequest((await getMessages()).medicines.taken);
    return ok({ medicine: await createMedicine(data) }, 201);
  } catch (err) {
    return serverError("add a medicine", err);
  }
}
