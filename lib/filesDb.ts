import "server-only";
import { desc, eq } from "drizzle-orm";
import { FILE_KINDS, type FileKind, type PatientFile } from "./clinic";
import { getDb } from "./db";
import { patientFileData, patientFiles } from "./db/schema";

const asKind = (k: string): FileKind => (FILE_KINDS.includes(k as FileKind) ? (k as FileKind) : "other");

function toFile(r: typeof patientFiles.$inferSelect): PatientFile {
  return { id: r.id, patientId: r.patientId, visitId: r.visitId, kind: asKind(r.kind), title: r.title, mime: r.mime, size: r.size, createdAt: r.createdAt, createdBy: r.createdBy };
}

export async function listFiles(patientId: number): Promise<PatientFile[]> {
  const db = await getDb();
  const rows = await db.select().from(patientFiles).where(eq(patientFiles.patientId, patientId)).orderBy(desc(patientFiles.createdAt));
  return rows.map(toFile);
}

export async function getFileMeta(id: number): Promise<PatientFile | null> {
  const db = await getDb();
  const [row] = await db.select().from(patientFiles).where(eq(patientFiles.id, id));
  return row ? toFile(row) : null;
}

export async function getFileData(id: number): Promise<Buffer | null> {
  const db = await getDb();
  const [row] = await db.select().from(patientFileData).where(eq(patientFileData.fileId, id));
  return row ? Buffer.from(row.data) : null;
}

export async function addFile(input: { patientId: number; visitId: number | null; kind: FileKind; title: string; mime: string; data: Buffer; by: string }): Promise<PatientFile> {
  const db = await getDb();
  const [row] = await db
    .insert(patientFiles)
    .values({ patientId: input.patientId, visitId: input.visitId, kind: input.kind, title: input.title, mime: input.mime, size: input.data.length, createdBy: input.by, createdAt: Date.now() })
    .returning();
  try {
    await db.insert(patientFileData).values({ fileId: row.id, data: input.data });
  } catch (err) {
    await db.delete(patientFiles).where(eq(patientFiles.id, row.id));
    throw err;
  }
  return toFile(row);
}

export async function deleteFile(id: number): Promise<boolean> {
  const db = await getDb();
  await db.delete(patientFileData).where(eq(patientFileData.fileId, id));
  const rows = await db.delete(patientFiles).where(eq(patientFiles.id, id)).returning({ id: patientFiles.id });
  return rows.length > 0;
}

// Checks the first bytes, so a file is what it says it is.
export function sniffMime(data: Buffer): string | null {
  if (data.length > 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return "image/jpeg";
  if (data.length > 8 && data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (data.length > 12 && data.subarray(0, 4).toString("ascii") === "RIFF" && data.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  if (data.length > 5 && data.subarray(0, 5).toString("ascii") === "%PDF-") return "application/pdf";
  return null;
}
