import type { NextRequest } from "next/server";
import { notFound, ok, parseBody, parseId, serverError } from "@/lib/api";
import { orderResultSchema } from "@/lib/clinic";
import { requirePatient } from "@/lib/guards";
import { deleteOrder, getOrder, updateOrder } from "@/lib/visitsDb";

type Params = { params: Promise<{ id: string }> };

async function guard(id: number) {
  const order = await getOrder(id);
  if (!order) return { error: await notFound() };
  return requirePatient(order.patientId, "full", "files");
}

// PATCH { status, result } → records the result.
export async function PATCH(request: NextRequest, { params }: Params) {
  const id = parseId((await params).id);
  if (!id) return notFound();
  const g = await guard(id);
  if (g.error) return g.error;
  const { data, error } = await parseBody(request, orderResultSchema);
  if (error) return error;
  try {
    return ok({ order: await updateOrder(id, data) });
  } catch (err) {
    return serverError("change an order", err);
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const id = parseId((await params).id);
  if (!id) return notFound();
  const g = await guard(id);
  if (g.error) return g.error;
  try {
    await deleteOrder(id);
    return ok({ ok: true });
  } catch (err) {
    return serverError("delete an order", err);
  }
}
