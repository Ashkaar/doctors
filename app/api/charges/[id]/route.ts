import type { NextRequest } from "next/server";
import { logActivity } from "@/lib/activity";
import { actorOf, notFound, ok, parseId, requireOwner, serverError } from "@/lib/api";
import { voidCharge } from "@/lib/moneyDb";

// DELETE → cancels a fee (kept, marked cancelled). Owner only.
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) return notFound();
  const { viewer, error } = await requireOwner();
  if (error) return error;
  try {
    if (!(await voidCharge(id))) return notFound();
    await logActivity(actorOf(viewer), "fee-cancelled", `charge ${id}`);
    return ok({ ok: true });
  } catch (err) {
    return serverError("cancel a fee", err);
  }
}
