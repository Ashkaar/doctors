import type { NextRequest } from "next/server";
import { notFound, ok, parseBody, parseId, requireOwner, serverError } from "@/lib/api";
import { serviceSchema } from "@/lib/clinic";
import { updateService } from "@/lib/moneyDb";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) return notFound();
  const { error: authError } = await requireOwner();
  if (authError) return authError;
  const { data, error } = await parseBody(request, serviceSchema);
  if (error) return error;
  try {
    const service = await updateService(id, data);
    return service ? ok({ service }) : notFound();
  } catch (err) {
    return serverError("change a service", err);
  }
}
