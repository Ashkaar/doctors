import type { NextRequest } from "next/server";
import { logActivity } from "@/lib/activity";
import { actorOf, notFound, ok, parseId, requireOwner, serverError } from "@/lib/api";
import { voidPayment } from "@/lib/moneyDb";

// DELETE → cancels a payment (kept, marked cancelled). Owner only.
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) return notFound();
  const { viewer, error } = await requireOwner();
  if (error) return error;
  try {
    if (!(await voidPayment(id))) return notFound();
    await logActivity(actorOf(viewer), "payment-cancelled", `payment ${id}`);
    return ok({ ok: true });
  } catch (err) {
    return serverError("cancel a payment", err);
  }
}
