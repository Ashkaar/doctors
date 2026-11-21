import { describe, expect, it } from "vitest";
import { describeError } from "@/lib/safeLog";

describe("server logs", () => {
  it("never include an error's message, which can carry patient data", () => {
    const err = new Error('Failed query: insert into "patients" params: Sara Ahmed,07501234567');
    const text = describeError(err);
    expect(text).not.toContain("Sara");
    expect(text).not.toContain("0750");
    expect(text).toBe("Error");
  });
  it("keep the error's kind and code, and its cause", () => {
    const cause = Object.assign(new Error("SQLITE_CONSTRAINT: UNIQUE constraint failed: patients.file_no"), { code: "SQLITE_CONSTRAINT" });
    const err = new Error("wrapped", { cause });
    expect(describeError(err)).toBe("Error ← Error SQLITE_CONSTRAINT");
    expect(describeError("text")).toBe("unknown error");
  });
});
