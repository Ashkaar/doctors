import type { NextRequest } from "next/server";
import { actorOf, ok, parseBody, serverError } from "@/lib/api";
import { expenseSchema } from "@/lib/clinic";
import { requireRecord } from "@/lib/guards";
import { addExpense } from "@/lib/moneyDb";

export async function POST(request: NextRequest) {
  const { viewer, error: authError } = await requireRecord("expenses");
  if (authError) return authError;
  const { data, error } = await parseBody(request, expenseSchema);
  if (error) return error;
  try {
    return ok({ expense: await addExpense(data, actorOf(viewer)) }, 201);
  } catch (err) {
    return serverError("add an expense", err);
  }
}
