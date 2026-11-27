import { DoctorsManager } from "@/components/doctors-manager";
import { UnlockGate } from "@/components/unlock-gate";
import { listDoctors } from "@/lib/doctorsDb";
import { clinicFeatures } from "@/lib/features";
import { requireSectionPage } from "@/lib/pageAccess";
import { getHours, requestToday } from "@/lib/settingsDb";
import { listStaff } from "@/lib/staffDb";

export default async function DoctorsPage() {
  const { locked } = await requireSectionPage("doctors");
  if (locked) return <UnlockGate />;
  const [doctors, staff, features, hours, { day }] = await Promise.all([listDoctors(), listStaff(), clinicFeatures(), getHours(), requestToday()]);
  return (
    <DoctorsManager
      initial={doctors}
      logins={staff.filter((s) => s.role === "doctor").map((s) => ({ id: s.id, name: s.name }))}
      many={features.includes("manyDoctors")}
      shares={features.includes("shares")}
      clinicHours={hours}
      today={day}
    />
  );
}
