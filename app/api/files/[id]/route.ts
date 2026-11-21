import type { NextRequest } from "next/server";
import { logActivity } from "@/lib/activity";
import { actorOf, notFound, ok, parseId, serverError } from "@/lib/api";
import { deleteFile, getFileData, getFileMeta } from "@/lib/filesDb";
import { requirePatient } from "@/lib/guards";

type Params = { params: Promise<{ id: string }> };

// GET → the file, shown in the browser (images, PDFs). Never cached.
export async function GET(request: NextRequest, { params }: Params) {
  const id = parseId((await params).id);
  if (!id) return notFound();
  try {
    const meta = await getFileMeta(id);
    if (!meta) return notFound();
    const { error } = await requirePatient(meta.patientId, "full", "files");
    if (error) return error;
    const data = await getFileData(id);
    if (!data) return notFound();
    const download = request.nextUrl.searchParams.get("download") === "1";
    const ext = meta.mime === "application/pdf" ? "pdf" : meta.mime.split("/")[1];
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": meta.mime,
        "Content-Length": String(data.length),
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="file-${meta.id}.${ext}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; object-src 'self'",
      },
    });
  } catch (err) {
    return serverError("read a file", err);
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const id = parseId((await params).id);
  if (!id) return notFound();
  try {
    const meta = await getFileMeta(id);
    if (!meta) return notFound();
    const { viewer, error } = await requirePatient(meta.patientId, "full", "files");
    if (error) return error;
    await deleteFile(id);
    await logActivity(actorOf(viewer), "file-deleted", `patient ${meta.patientId}`);
    return ok({ ok: true });
  } catch (err) {
    return serverError("delete a file", err);
  }
}
