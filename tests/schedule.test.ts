import { describe, expect, it } from "vitest";
import { hoursOn, parseSchedule, scheduleSchema, type DoctorSchedule } from "@/lib/clinic";

const clinic = { startMin: 540, endMin: 1260 };
// Saturday to Thursday 16:00–21:00, Friday off.
const week: DoctorSchedule["week"] = [[960, 1260], [960, 1260], [960, 1260], [960, 1260], [960, 1260], null, [960, 1260]];

describe("doctor schedules", () => {
  it("use the clinic's hours when the doctor has no week of their own", () => {
    expect(hoursOn({ week: null, off: [] }, "2026-11-27", 5, clinic)).toEqual(clinic);
  });
  it("follow the doctor's own week", () => {
    expect(hoursOn({ week, off: [] }, "2026-11-28", 6, clinic)).toEqual({ startMin: 960, endMin: 1260 });
    expect(hoursOn({ week, off: [] }, "2026-11-27", 5, clinic)).toEqual({ off: "closed", note: "" });
  });
  it("put days off first, inclusive of both ends", () => {
    const s: DoctorSchedule = { week, off: [{ from: "2026-12-01", to: "2026-12-03", note: "Conference" }] };
    expect(hoursOn(s, "2026-12-01", 2, clinic)).toEqual({ off: "off", note: "Conference" });
    expect(hoursOn(s, "2026-12-03", 4, clinic)).toEqual({ off: "off", note: "Conference" });
    expect(hoursOn(s, "2026-12-04", 5, clinic)).toEqual({ off: "closed", note: "" });
    expect(hoursOn(s, "2026-12-05", 6, clinic)).toEqual({ startMin: 960, endMin: 1260 });
  });
  it("refuse a week that isn't 7 days, a day ending before it starts, and days off backwards", () => {
    expect(scheduleSchema.safeParse({ week: week!.slice(0, 6), off: [] }).success).toBe(false);
    expect(scheduleSchema.safeParse({ week: [[600, 500], null, null, null, null, null, null], off: [] }).success).toBe(false);
    expect(scheduleSchema.safeParse({ week: null, off: [{ from: "2026-12-03", to: "2026-12-01" }] }).success).toBe(false);
  });
  it("read old or broken values as the clinic's hours", () => {
    expect(parseSchedule("")).toEqual({ week: null, off: [] });
    expect(parseSchedule("{bad")).toEqual({ week: null, off: [] });
    expect(parseSchedule(JSON.stringify({ week, off: [] })).week).toEqual(week);
  });
});
