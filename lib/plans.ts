import { SECTIONS, type Section } from "./sections";
import type { PlanId } from "./shopState";

// What each Ariloo plan opens. This is the ONE place plans are mapped to
// sections and features: getViewer() (lib/access.ts) only ever returns
// sections in the clinic's plan, and clinicFeatures() (lib/features.ts) only
// features in it, so the navigation, the pages and the API all follow.
//
// A trial has everything (tenant.ts treats it as "advanced"). Dashboard,
// Staff and Settings must stay in every plan.
//
// - Starter: run the front desk and the consulting room for one doctor:
//   appointments, queue, patients with visit notes, and fees.
// - Pro: a busier clinic: prescriptions (and saved medicines), lab results
//   and files with lab and X-ray orders, expenses, several doctors.
// - Advanced: the owner's numbers: reports, doctors' income shares, and
//   exporting every record.

const STARTER: readonly Section[] = ["dashboard", "appointments", "queue", "patients", "payments", "doctors", "staff", "settings"];
const PRO: readonly Section[] = [...STARTER, "expenses", "medicines"];

export const PLAN_SECTIONS: Record<PlanId, readonly Section[]> = {
  starter: STARTER,
  pro: PRO,
  advanced: SECTIONS,
};

// Features inside screens that a plan opens.
export const FEATURES = ["prescriptions", "files", "manyDoctors", "shares", "export"] as const;
export type Feature = (typeof FEATURES)[number];

export const PLAN_FEATURES: Record<PlanId, readonly Feature[]> = {
  starter: [],
  pro: ["prescriptions", "files", "manyDoctors"],
  advanced: FEATURES,
};

// How many doctors can be active at once without "manyDoctors".
export const STARTER_DOCTORS = 1;

// Single-shop mode (local development) → everything.
export function sectionsInPlan(plan: PlanId | null, singleShop: boolean): readonly Section[] {
  if (singleShop) return SECTIONS;
  return plan ? PLAN_SECTIONS[plan] : [];
}

export function featuresInPlan(plan: PlanId | null, singleShop: boolean): readonly Feature[] {
  if (singleShop) return FEATURES;
  return plan ? PLAN_FEATURES[plan] : [];
}
