import type { NextRequest } from "next/server";
import { logActivity } from "@/lib/activity";
import { actorOf, badRequest, notFound, ok, parseId, serverError } from "@/lib/api";
import { FILE_KINDS, MAX_FILE_BYTES, type FileKind } from "@/lib/clinic";
import { addFile, sniffMime } from "@/lib/filesDb";
import { requirePatient } from "@/lib/guards";
import { getMessages } from "@/lib/i18n/server";

// POST (the file as the body) ?kind=&title=&visit= → adds a lab result,
// X-ray or document to the patient's file. Full medical record only.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) return notFound();
  const { viewer, error } = await requirePatient(id, "full", "files");
  if (error) return error;
  const m = (await getMessages()).errors;
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_FILE_BYTES) return badRequest(m.fileTooBig);
  try {
    const data = Buffer.from(await request.arrayBuffer());
    if (data.length === 0) return badRequest();
    if (data.length > MAX_FILE_BYTES) return badRequest(m.fileTooBig);
    const mime = sniffMime(data);
    if (!mime) return badRequest(m.fileType);
    const q = request.nextUrl.searchParams;
    const kindParam = q.get("kind") ?? "other";
    const kind: FileKind = FILE_KINDS.includes(kindParam as FileKind) ? (kindParam as FileKind) : "other";
    const visitId = parseId(q.get("visit") ?? "");
    const file = await addFile({ patientId: id, visitId, kind, title: (q.get("title") ?? "").trim().slice(0, 120), mime, data, by: actorOf(viewer) });
    await logActivity(actorOf(viewer), "file-added", `patient ${id}`);
    return ok({ file }, 201);
  } catch (err) {
    return serverError("add a file", err);
  }
}
