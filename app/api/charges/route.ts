import type { NextRequest } from "next/server";
import { logActivity } from "@/lib/activity";
import { actorOf, badRequest, ok, parseBody, serverError } from "@/lib/api";
import { chargeSchema } from "@/lib/clinic";
import { getDoctor } from "@/lib/doctorsDb";
import { requirePatient, requireRecord } from "@/lib/guards";
import { getMessages } from "@/lib/i18n/server";
import { addCharge, getService } from "@/lib/moneyDb";
import { requestToday } from "@/lib/settingsDb";
import { visitPatientId } from "@/lib/visitsDb";

// POST { patientId, serviceId?, amount, discount, paid, method, … } → a
// fee for the patient, and what they paid now. A service's price comes
// from the price list, not from the browser.
export async function POST(request: NextRequest) {
  const g = await requireRecord("payments");
  if (g.error) return g.error;
  const { data, error } = await parseBody(request, chargeSchema);
  if (error) return error;
  const p = await requirePatient(data.patientId);
  if (p.error) return p.error;
  try {
    let { amount, description } = data;
    if (data.serviceId) {
      const service = await getService(data.serviceId);
      if (!service) return badRequest();
      amount = service.price;
      description = service.name;
    }
    if (!description) description = (await getMessages()).payments.visitFee;
    if (data.discount > amount) return badRequest();
    if (data.visitId && (await visitPatientId(data.visitId)) !== data.patientId) return badRequest();
    if (data.doctorId && !(await getDoctor(data.doctorId))) return badRequest();
    const { day } = await requestToday();
    const result = await addCharge({ ...data, amount, description, paid: Math.min(data.paid, amount - data.discount) }, day, actorOf(g.viewer));
    await logActivity(actorOf(g.viewer), "fee-added", `charge ${result.charge.id}`);
    return ok(result, 201);
  } catch (err) {
    return serverError("add a fee", err);
  }
}
