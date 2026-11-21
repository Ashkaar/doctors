import {
  CalendarDaysIcon,
  ChartColumnIcon,
  ContactRoundIcon,
  HouseIcon,
  ListOrderedIcon,
  PillIcon,
  SettingsIcon,
  StethoscopeIcon,
  UsersIcon,
  WalletIcon,
  BanknoteIcon,
  type LucideIcon,
} from "lucide-react";
import type { Messages } from "@/lib/i18n";
import { SECTION_HREF, type Section } from "@/lib/sections";

// How each section appears in the navigation. `primary` sections get a
// place on the phone's tab bar; the rest go under "More".
export const NAV: Record<Section, { icon: LucideIcon; label: (t: Messages) => string; primary: boolean }> = {
  dashboard: { icon: HouseIcon, label: (t) => t.nav.dashboard, primary: true },
  appointments: { icon: CalendarDaysIcon, label: (t) => t.nav.appointments, primary: true },
  queue: { icon: ListOrderedIcon, label: (t) => t.nav.queue, primary: true },
  patients: { icon: ContactRoundIcon, label: (t) => t.nav.patients, primary: true },
  payments: { icon: BanknoteIcon, label: (t) => t.nav.payments, primary: false },
  expenses: { icon: WalletIcon, label: (t) => t.nav.expenses, primary: false },
  medicines: { icon: PillIcon, label: (t) => t.nav.medicines, primary: false },
  reports: { icon: ChartColumnIcon, label: (t) => t.nav.reports, primary: false },
  doctors: { icon: StethoscopeIcon, label: (t) => t.nav.doctors, primary: false },
  staff: { icon: UsersIcon, label: (t) => t.nav.staff, primary: false },
  settings: { icon: SettingsIcon, label: (t) => t.nav.settings, primary: false },
};

export function navItems(sections: readonly Section[], t: Messages) {
  return sections.map((s) => ({ section: s, href: SECTION_HREF[s], label: NAV[s].label(t), icon: NAV[s].icon, primary: NAV[s].primary }));
}

export function isActive(path: string, href: string): boolean {
  return href === "/dashboard" ? path === href : path === href || path.startsWith(`${href}/`);
}
