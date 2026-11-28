import { describe, expect, it } from "vitest";
import type { Charge, Doctor, Payment } from "@/lib/clinic";
import { buildReport, shareOf } from "@/lib/reports";

const doctor = (id: number, shareBp: number): Doctor => ({ id, name: `Dr ${id}`, specialty: "", phone: "", licence: "", room: "", staffId: null, shareBp, slotMinutes: 15, active: true, schedule: { week: null, off: [] } });
const charge = (id: number, doctorId: number | null, amount: number, discount = 0, voided = false): Charge & { day: string } => ({
  id,
  patientId: 1,
  patientName: "",
  visitId: null,
  doctorId,
  description: "Consultation",
  amount,
  discount,
  at: 0,
  createdBy: "",
  voided,
  day: "2026-11-01",
});
const payment = (id: number, amount: number, method: Payment["method"] = "cash", voided = false): Payment & { day: string } => ({
  id,
  patientId: 1,
  patientName: "",
  amount,
  method,
  at: 0,
  createdBy: "",
  voided,
  day: "2026-11-02",
});

describe("reports", () => {
  it("adds up fees, payments, expenses, shares and net", () => {
    const r = buildReport({
      from: "2026-11-01",
      to: "2026-12-01",
      charges: [charge(1, 1, 25_000_00, 5_000_00), charge(2, 2, 10_000_00), charge(3, 1, 99_00, 0, true)],
      payments: [payment(1, 20_000_00), payment(2, 5_000_00, "card"), payment(3, 1_00, "cash", true)],
      expenses: [{ id: 1, day: "2026-11-03", category: "Rent", description: "", amount: 3_000_00, createdBy: "" }],
      doctors: [doctor(1, 5000), doctor(2, 0)],
      visitsByDoctor: [{ doctorId: 1, n: 3 }, { doctorId: 2, n: 1 }],
      newPatients: 2,
      withShares: true,
    });
    expect(r.billed).toBe(30_000_00);
    expect(r.discounts).toBe(5_000_00);
    expect(r.collected).toBe(25_000_00);
    expect(r.expenses).toBe(3_000_00);
    expect(r.shares).toBe(10_000_00);
    expect(r.net).toBe(25_000_00 - 3_000_00 - 10_000_00);
    expect(r.visits).toBe(4);
    expect(r.byMethod).toEqual({ cash: 20_000_00, card: 5_000_00 });
    expect(r.byDoctor[0]).toMatchObject({ doctorId: 1, visits: 3, billed: 20_000_00, share: 10_000_00 });
    expect(r.byDay.map((d) => d.day)).toEqual(["2026-11-01", "2026-11-02"]);
  });
  it("leaves shares out when the plan hasn't got them", () => {
    const r = buildReport({ from: "a", to: "b", charges: [charge(1, 1, 100_00)], payments: [], expenses: [], doctors: [doctor(1, 5000)], visitsByDoctor: [], newPatients: 0, withShares: false });
    expect(r.shares).toBe(0);
  });
  it("rounds a share to whole hundredths", () => {
    expect(shareOf(333, 3333)).toBe(111);
  });
});
