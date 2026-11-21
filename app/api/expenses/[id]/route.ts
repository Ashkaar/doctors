import type { NextRequest } from "next/server";
import { notFound, ok, parseId, serverError } from "@/lib/api";
import { requireRecord } from "@/lib/guards";
import { deleteExpense } from "@/lib/moneyDb";

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) return notFound();
  const { error } = await requireRecord("expenses");
  if (error) return error;
  try {
    return (await deleteExpense(id)) ? ok({ ok: true }) : notFound();
  } catch (err) {
    return serverError("delete an expense", err);
  }
}
