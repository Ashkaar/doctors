import type { NextRequest } from "next/server";
import { z } from "zod";
import { logActivity } from "@/lib/activity";
import { actorOf, notFound, ok, parseBody, parseId, serverError } from "@/lib/api";
import { requirePatient } from "@/lib/guards";
import { getMessages } from "@/lib/i18n/server";
import { addCharge } from "@/lib/moneyDb";
import { requestToday } from "@/lib/settingsDb";
import { deleteWork, getWork, setWorkStatus } from "@/lib/specialtiesDb";

type Params = { params: Promise<{ id: string }> };

async function guard(id: number) {
  const work = await getWork(id);
  if (!work) return { work: null, viewer: null, error: await notFound() };
  const g = await requirePatient(work.patientId, "full");
  return g.error ? { work: null, viewer: null, error: g.error } : { work, viewer: g.viewer, error: null };
}

const schema = z.object({
  status: z.enum(["planned", "done"]),
  // Marking it done can also add its fee to what the patient owes.
  bill: z.boolean().default(false),
  doctorId: z.number().int().positive().nullable().default(null),
});

// PATCH { status, bill?, doctorId? } → planned or done.
export async function PATCH(request: NextRequest, { params }: Params) {
  const id = parseId((await params).id);
  if (!id) return notFound();
  const { work, viewer, error: authError } = await guard(id);
  if (authError) return authError;
  const { data, error } = await parseBody(request, schema);
  if (error) return error;
  try {
    let chargeId: number | undefined;
    if (data.status === "done" && data.bill && work.fee > 0 && !work.chargeId) {
      const { day } = await requestToday();
      const t = await getMessages();
      const label = `${t.dental.procedures[work.procedure]}${work.tooth ? ` · ${t.dental.toothShort(work.tooth)}` : ""}`;
      const { charge } = await addCharge(
        { patientId: work.patientId, visitId: work.visitId, doctorId: data.doctorId ?? viewer.doctorId, serviceId: null, description: label, amount: work.fee, discount: 0, paid: 0, method: "cash" },
        day,
        actorOf(viewer),
      );
      chargeId = charge.id;
    }
    const updated = await setWorkStatus(id, data.status, chargeId);
    await logActivity(actorOf(viewer), data.status === "done" ? "dental-done" : "dental-planned", `patient ${work.patientId}`);
    return ok({ work: updated });
  } catch (err) {
    return serverError("change dental work", err);
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const id = parseId((await params).id);
  if (!id) return notFound();
  const { error } = await guard(id);
  if (error) return error;
  try {
    await deleteWork(id);
    return ok({ ok: true });
  } catch (err) {
    return serverError("delete dental work", err);
  }
}
