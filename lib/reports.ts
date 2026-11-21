// Report figures, worked out from the rows (pure, client-safe and tested).

import type { Charge, Doctor, Expense, Payment } from "./clinic";

export interface Report {
  from: string;
  to: string;
  visits: number;
  newPatients: number;
  billed: number;
  discounts: number;
  collected: number;
  expenses: number;
  // collected − expenses − doctors' shares
  net: number;
  shares: number;
  byDoctor: { doctorId: number | null; name: string; visits: number; billed: number; share: number }[];
  byService: { name: string; count: number; billed: number }[];
  byDay: { day: string; billed: number; collected: number }[];
  byMethod: Record<string, number>;
  byCategory: { category: string; amount: number }[];
}

// A doctor's share of what they billed, in whole hundredths.
export const shareOf = (billed: number, shareBp: number) => Math.round((billed * shareBp) / 10_000);

export function buildReport(input: {
  from: string;
  to: string;
  charges: (Charge & { day: string })[];
  payments: (Payment & { day: string })[];
  expenses: Expense[];
  doctors: Doctor[];
  visitsByDoctor: { doctorId: number; n: number }[];
  newPatients: number;
  withShares: boolean;
}): Report {
  const live = input.charges.filter((c) => !c.voided);
  const paid = input.payments.filter((p) => !p.voided);
  const billed = live.reduce((s, c) => s + c.amount - c.discount, 0);
  const discounts = live.reduce((s, c) => s + c.discount, 0);
  const collected = paid.reduce((s, p) => s + p.amount, 0);
  const spent = input.expenses.reduce((s, e) => s + e.amount, 0);

  const doctorMap = new Map(input.doctors.map((d) => [d.id, d]));
  const byDoctorMap = new Map<number | null, { doctorId: number | null; name: string; visits: number; billed: number; share: number }>();
  const row = (id: number | null) => {
    let r = byDoctorMap.get(id);
    if (!r) {
      r = { doctorId: id, name: id == null ? "" : (doctorMap.get(id)?.name ?? ""), visits: 0, billed: 0, share: 0 };
      byDoctorMap.set(id, r);
    }
    return r;
  };
  for (const v of input.visitsByDoctor) row(v.doctorId).visits += v.n;
  for (const c of live) row(c.doctorId).billed += c.amount - c.discount;
  let shares = 0;
  for (const r of byDoctorMap.values()) {
    if (input.withShares && r.doctorId != null) r.share = shareOf(r.billed, doctorMap.get(r.doctorId)?.shareBp ?? 0);
    shares += r.share;
  }

  const services = new Map<string, { name: string; count: number; billed: number }>();
  for (const c of live) {
    const s = services.get(c.description) ?? { name: c.description, count: 0, billed: 0 };
    s.count++;
    s.billed += c.amount - c.discount;
    services.set(c.description, s);
  }

  const days = new Map<string, { day: string; billed: number; collected: number }>();
  const dayRow = (day: string) => {
    let d = days.get(day);
    if (!d) days.set(day, (d = { day, billed: 0, collected: 0 }));
    return d;
  };
  for (const c of live) dayRow(c.day).billed += c.amount - c.discount;
  for (const p of paid) dayRow(p.day).collected += p.amount;

  const byMethod: Record<string, number> = {};
  for (const p of paid) byMethod[p.method] = (byMethod[p.method] ?? 0) + p.amount;

  const cats = new Map<string, number>();
  for (const e of input.expenses) cats.set(e.category, (cats.get(e.category) ?? 0) + e.amount);

  return {
    from: input.from,
    to: input.to,
    visits: input.visitsByDoctor.reduce((s, v) => s + v.n, 0),
    newPatients: input.newPatients,
    billed,
    discounts,
    collected,
    expenses: spent,
    shares,
    net: collected - spent - shares,
    byDoctor: [...byDoctorMap.values()].sort((a, b) => b.billed - a.billed),
    byService: [...services.values()].sort((a, b) => b.billed - a.billed),
    byDay: [...days.values()].sort((a, b) => a.day.localeCompare(b.day)),
    byMethod,
    byCategory: [...cats.entries()].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount),
  };
}
