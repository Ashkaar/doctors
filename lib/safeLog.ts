// Patient information must never reach the server log. Database errors can
// carry the query and its values (names, notes), so only the error's kind
// and code are ever written.
export function describeError(error: unknown): string {
  if (!(error instanceof Error)) return "unknown error";
  const seen = new Set<unknown>();
  let e: unknown = error;
  const parts: string[] = [];
  while (e instanceof Error && !seen.has(e) && parts.length < 4) {
    seen.add(e);
    const code = (e as { code?: unknown }).code;
    parts.push(`${e.name}${typeof code === "string" ? ` ${code}` : ""}`);
    e = (e as { cause?: unknown }).cause;
  }
  return parts.join(" ← ");
}

export function logError(action: string, error: unknown): void {
  console.error(`Failed to ${action}: ${describeError(error)}`);
}
