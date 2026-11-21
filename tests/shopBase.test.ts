import { describe, expect, it } from "vitest";
import { shopKey, withBase, withoutBase } from "@/lib/shopBase";

describe("shop addresses", () => {
  it("adds the shop's address to app paths only", () => {
    expect(withBase("/api/staff", "/city-clinic")).toBe("/city-clinic/api/staff");
    expect(withBase("/city-clinic/api/staff", "/city-clinic")).toBe("/city-clinic/api/staff");
    expect(withBase("https://ariloo.app", "/city-clinic")).toBe("https://ariloo.app");
    expect(withBase("//evil.example", "/city-clinic")).toBe("//evil.example");
    expect(withBase("/api/staff", "")).toBe("/api/staff");
  });
  it("removes it again", () => {
    expect(withoutBase("/city-clinic/dashboard", "/city-clinic")).toBe("/dashboard");
    expect(withoutBase("/city-clinic", "/city-clinic")).toBe("/");
  });
  it("keeps each shop's saved data apart", () => {
    expect(shopKey("outbox", "/city-clinic")).toBe("outbox:city-clinic");
    expect(shopKey("outbox", "")).toBe("outbox");
  });
});
