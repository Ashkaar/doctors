import type { NextRequest } from "next/server";
import { z } from "zod";
import { ok, parseBody, requireOwner, serverError } from "@/lib/api";
import { setClinicTypes, setHours, setPrintSettings } from "@/lib/settingsDb";
import { clinicTypesSchema } from "@/lib/specialties";

const schema = z.object({
  print: z.object({ paper: z.enum(["a5", "a4"]), header: z.string().max(300), footer: z.string().max(300) }).optional(),
  hours: z.object({ startMin: z.number().int().min(0).max(1440), endMin: z.number().int().min(0).max(1440) }).optional(),
  types: clinicTypesSchema.optional(),
});

// PUT { print?, hours?, types? } → the clinic's printing, booking hours and
// kind of clinic (which charts it uses). Owner only.
export async function PUT(request: NextRequest) {
  const { error: authError } = await requireOwner();
  if (authError) return authError;
  const { data, error } = await parseBody(request, schema);
  if (error) return error;
  try {
    if (data.print) await setPrintSettings(data.print);
    if (data.hours) await setHours(data.hours);
    if (data.types) await setClinicTypes(data.types);
    return ok({ ok: true });
  } catch (err) {
    return serverError("save clinic settings", err);
  }
}
