import type { NextRequest } from "next/server";
import { ok, parseBody, requireOwner, serverError } from "@/lib/api";
import { serviceSchema } from "@/lib/clinic";
import { createService } from "@/lib/moneyDb";

// POST { name, price } → a fee on the price list. Owner only.
export async function POST(request: NextRequest) {
  const { error: authError } = await requireOwner();
  if (authError) return authError;
  const { data, error } = await parseBody(request, serviceSchema);
  if (error) return error;
  try {
    return ok({ service: await createService(data) }, 201);
  } catch (err) {
    return serverError("add a service", err);
  }
}
