import "server-only";
import { getDb } from "./db";
import { logError } from "./safeLog";

// The owner's export of the clinic's records. Streamed in pages, so a big
// clinic never builds the whole file in memory (and Vercel's response size
// limit doesn't apply to a stream). Secrets and password hashes are never
// included; file contents are left out of the full export (each file is
// downloaded from the patient's page) and included in one patient's export.

export const EXPORT_TABLES = [
  "patients",
  "appointments",
  "queue",
  "visits",
  "prescription_items",
  "orders",
  "patient_files",
  "charges",
  "payments",
  "doctors",
  "services",
  "medicines",
  "expenses",
] as const;

const PAGE = 500;

async function* rowsOf(table: string, where = "", args: (string | number)[] = []): AsyncGenerator<Record<string, unknown>> {
  const { $client: client } = await getDb();
  let last = 0;
  const key = table === "patient_file_data" ? "file_id" : "id";
  for (;;) {
    const { rows } = await client.execute({
      sql: `SELECT * FROM ${table} WHERE ${key} > ?${where ? ` AND ${where}` : ""} ORDER BY ${key} LIMIT ${PAGE}`,
      args: [last, ...args],
    });
    for (const r of rows) yield Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v instanceof ArrayBuffer ? Buffer.from(v).toString("base64") : typeof v === "bigint" ? Number(v) : v]));
    if (rows.length < PAGE) return;
    last = Number(rows[rows.length - 1][key]);
  }
}

function streamOf(parts: () => AsyncGenerator<string>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const it = parts();
  return new ReadableStream({
    async pull(controller) {
      try {
        const { value, done } = await it.next();
        if (done) controller.close();
        else controller.enqueue(encoder.encode(value));
      } catch (err) {
        logError("export", err);
        controller.error(err);
      }
    },
  });
}

// { "exportedAt": …, "clinic": …, "tables": { "patients": [ … ], … } }
export function exportAllJson(clinic: string): ReadableStream<Uint8Array> {
  return streamOf(async function* () {
    yield `{"format":"doctors-export-1","exportedAt":${Date.now()},"clinic":${JSON.stringify(clinic)},"tables":{`;
    for (const [i, table] of EXPORT_TABLES.entries()) {
      yield `${i ? "," : ""}${JSON.stringify(table)}:[`;
      let first = true;
      for await (const row of rowsOf(table)) {
        yield `${first ? "" : ","}${JSON.stringify(row)}`;
        first = false;
      }
      yield "]";
    }
    yield "}}";
  });
}

const csvCell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  // A leading = + - @ would be run as a formula by spreadsheets.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export const CSV_TABLES = ["patients", "visits", "appointments", "charges", "payments", "expenses"] as const;

export function exportCsv(table: (typeof CSV_TABLES)[number]): ReadableStream<Uint8Array> {
  return streamOf(async function* () {
    // A byte-order mark, so spreadsheets read Kurdish and Arabic correctly.
    yield "﻿";
    let header: string[] | null = null;
    for await (const row of rowsOf(table)) {
      if (!header) {
        header = Object.keys(row);
        yield `${header.join(",")}\r\n`;
      }
      yield `${header.map((k) => csvCell(row[k])).join(",")}\r\n`;
    }
  });
}

// Everything about one patient, files included.
export function exportPatientJson(patientId: number): ReadableStream<Uint8Array> {
  return streamOf(async function* () {
    yield `{"format":"doctors-patient-1","exportedAt":${Date.now()},"tables":{`;
    const parts: [string, string, (string | number)[]][] = [
      ["patients", "id = ?", [patientId]],
      ["appointments", "patient_id = ?", [patientId]],
      ["visits", "patient_id = ?", [patientId]],
      ["prescription_items", "visit_id IN (SELECT id FROM visits WHERE patient_id = ?)", [patientId]],
      ["orders", "patient_id = ?", [patientId]],
      ["patient_files", "patient_id = ?", [patientId]],
      ["patient_file_data", "file_id IN (SELECT id FROM patient_files WHERE patient_id = ?)", [patientId]],
      ["charges", "patient_id = ?", [patientId]],
      ["payments", "patient_id = ?", [patientId]],
    ];
    for (const [i, [table, where, args]] of parts.entries()) {
      yield `${i ? "," : ""}${JSON.stringify(table)}:[`;
      let first = true;
      for await (const row of rowsOf(table, where, args)) {
        yield `${first ? "" : ","}${JSON.stringify(row)}`;
        first = false;
      }
      yield "]";
    }
    yield "}}";
  });
}
