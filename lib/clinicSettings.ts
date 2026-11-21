// The clinic's own settings (client-safe types and defaults).

export type PaperSize = "a5" | "a4";

export interface PrintSettings {
  paper: PaperSize;
  // Lines under the clinic's name on printed prescriptions (address, phone, hours).
  header: string;
  footer: string;
}

export const DEFAULT_PRINT: PrintSettings = { paper: "a5", header: "", footer: "" };

const text = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

export function normalisePrint(value: unknown): PrintSettings {
  const v = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  return { paper: v.paper === "a4" ? "a4" : "a5", header: text(v.header, 300), footer: text(v.footer, 300) };
}

// Opening hours for booking: the day's first and last appointment time
// (minutes after midnight).
export interface HoursSettings {
  startMin: number;
  endMin: number;
}

export const DEFAULT_HOURS: HoursSettings = { startMin: 9 * 60, endMin: 21 * 60 };

export function normaliseHours(value: unknown): HoursSettings {
  const v = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const ok = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 24 * 60;
  const startMin = ok(v.startMin) ? v.startMin : DEFAULT_HOURS.startMin;
  const endMin = ok(v.endMin) && v.endMin > startMin ? v.endMin : Math.max(startMin + 60, DEFAULT_HOURS.endMin);
  return { startMin, endMin: Math.min(endMin, 24 * 60) };
}
