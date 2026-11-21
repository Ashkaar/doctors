import { describe, expect, it } from "vitest";

import { sniffMime } from "@/lib/filesDb";

describe("uploaded files", () => {
  it("are recognised by their first bytes, not their name", () => {
    expect(sniffMime(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]))).toBe("image/jpeg");
    expect(sniffMime(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe("image/png");
    expect(sniffMime(Buffer.from("%PDF-1.7\n"))).toBe("application/pdf");
    expect(sniffMime(Buffer.from("<svg onload=alert(1)>"))).toBeNull();
    expect(sniffMime(Buffer.from("<html>"))).toBeNull();
  });
});
