import type { NextRequest } from "next/server";
import { logActivity } from "@/lib/activity";
import { actorOf, ok, parseBody, serverError } from "@/lib/api";
import { paymentSchema } from "@/lib/clinic";
import { requirePatient, requireRecord } from "@/lib/guards";
import { addPayment } from "@/lib/moneyDb";
import { requestToday } from "@/lib/settingsDb";

// POST { patientId, amount, method } → money received from a patient.
export async function POST(request: NextRequest) {
  const g = await requireRecord("payments");
  if (g.error) return g.error;
  const { data, error } = await parseBody(request, paymentSchema);
  if (error) return error;
  const p = await requirePatient(data.patientId);
  if (p.error) return p.error;
  try {
    const { day } = await requestToday();
    const payment = await addPayment(data, day, actorOf(g.viewer));
    await logActivity(actorOf(g.viewer), "payment-added", `payment ${payment.id}`);
    return ok({ payment }, 201);
  } catch (err) {
    return serverError("record a payment", err);
  }
}
