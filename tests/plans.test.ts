import { describe, expect, it } from "vitest";
import { featuresInPlan, FEATURES, PLAN_FEATURES, PLAN_SECTIONS, sectionsInPlan } from "@/lib/plans";
import { SECTIONS } from "@/lib/sections";

describe("plans", () => {
  it("each plan includes the one below it", () => {
    for (const s of PLAN_SECTIONS.starter) expect(PLAN_SECTIONS.pro).toContain(s);
    for (const s of PLAN_SECTIONS.pro) expect(PLAN_SECTIONS.advanced).toContain(s);
    for (const f of PLAN_FEATURES.starter) expect(PLAN_FEATURES.pro).toContain(f);
    for (const f of PLAN_FEATURES.pro) expect(PLAN_FEATURES.advanced).toContain(f);
    expect([...PLAN_SECTIONS.advanced].sort()).toEqual([...SECTIONS].sort());
    expect([...PLAN_FEATURES.advanced].sort()).toEqual([...FEATURES].sort());
  });
  it("always opens dashboard, staff and settings", () => {
    for (const plan of ["starter", "pro", "advanced"] as const) for (const s of ["dashboard", "staff", "settings"] as const) expect(PLAN_SECTIONS[plan]).toContain(s);
  });
  it("gates what the owner chose", () => {
    expect(PLAN_SECTIONS.starter).toEqual(expect.arrayContaining(["appointments", "queue", "patients", "payments"]));
    expect(PLAN_SECTIONS.starter).not.toContain("expenses");
    expect(PLAN_SECTIONS.pro).not.toContain("reports");
    expect(featuresInPlan("starter", false)).toEqual(["export"]);
    expect(featuresInPlan("pro", false)).toEqual(expect.arrayContaining(["prescriptions", "files", "manyDoctors"]));
    expect(featuresInPlan("pro", false)).not.toContain("shares");
    // Owners can always take their records.
    for (const plan of ["starter", "pro", "advanced"] as const) expect(featuresInPlan(plan, false)).toContain("export");
    expect(sectionsInPlan(null, false)).toEqual([]);
    expect(sectionsInPlan(null, true)).toEqual(SECTIONS);
  });
});
