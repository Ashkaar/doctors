// The parts of the app. Staff logins are given a chosen list of these;
// the owner sees everything the clinic's plan includes. Safe to import from
// client components.

export const SECTIONS = [
  "dashboard",
  "appointments",
  "queue",
  "patients",
  "payments",
  "expenses",
  "medicines",
  "reports",
  "doctors",
  "staff",
  "settings",
] as const;

export type Section = (typeof SECTIONS)[number];

// Sections only the owner (or the owner password entered on the device)
// may open; they can't be given to a staff login.
export const OWNER_SECTIONS: readonly Section[] = ["doctors", "staff"];

// Sections a staff login can be given.
export const STAFF_SECTIONS: Section[] = SECTIONS.filter((s) => !OWNER_SECTIONS.includes(s));

export const SECTION_HREF: Record<Section, string> = {
  dashboard: "/dashboard",
  appointments: "/dashboard/appointments",
  queue: "/dashboard/queue",
  patients: "/dashboard/patients",
  payments: "/dashboard/payments",
  expenses: "/dashboard/expenses",
  medicines: "/dashboard/medicines",
  reports: "/dashboard/reports",
  doctors: "/dashboard/doctors",
  staff: "/dashboard/staff",
  settings: "/dashboard/settings",
};

export const isSection = (value: unknown): value is Section => SECTIONS.includes(value as Section);

// Where to land after signing in: the first section the login may open.
export function homeFor(sections: readonly Section[]): string {
  const first = SECTIONS.find((s) => sections.includes(s));
  return first ? SECTION_HREF[first] : "/dashboard";
}

// ---- Roles and medical records ---------------------------------------------
//
// Every staff login has a role. The role decides how much of the medical
// record it may see; the ticked sections decide which screens it opens.
// - doctor:    full medical record (visit notes, diagnosis, prescriptions,
//              files). With "own patients only", just the patients they
//              have seen or are booked to see.
// - nurse:     vitals and the medical alerts (allergies, conditions); no
//              visit notes or prescriptions.
// - reception: patient details, appointments, queue and fees; nothing
//              medical.
// The owner always has the full record.

export const ROLES = ["doctor", "nurse", "reception"] as const;
export type Role = (typeof ROLES)[number];
export const isRole = (value: unknown): value is Role => ROLES.includes(value as Role);

export type Clinical = "full" | "vitals" | "none";
export const CLINICAL_OF: Record<Role, Clinical> = { doctor: "full", nurse: "vitals", reception: "none" };

// The sections ticked for a new login of each role (the owner can change them).
export const ROLE_SECTIONS: Record<Role, Section[]> = {
  doctor: ["dashboard", "appointments", "queue", "patients", "medicines"],
  nurse: ["dashboard", "queue", "patients"],
  reception: ["dashboard", "appointments", "queue", "patients", "payments"],
};

// Who is signed in, as the screens see it.
export interface Viewer {
  kind: "owner" | "staff";
  // "" for the owner.
  name: string;
  staffId: number | null;
  role: Role | null;
  // How much of the medical record this login may see.
  clinical: Clinical;
  // The doctor this login is (a doctor login linked on the Doctors screen).
  doctorId: number | null;
  // A doctor login that sees only its own patients.
  ownPatientsOnly: boolean;
  // Sections this login may open right now.
  sections: Section[];
  // May manage staff, doctors and owner settings, and delete or export
  // patient records (owner, or owner password entered here).
  isOwner: boolean;
  // The owner password is entered on this device (shows "Lock").
  unlocked: boolean;
}

export const MAX_STAFF_NAME_LENGTH = 40;
export const MIN_PASSWORD_LENGTH = 6;
export const MIN_OWNER_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 100;
