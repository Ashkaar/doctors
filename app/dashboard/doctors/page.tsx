import { DoctorsManager } from "@/components/doctors-manager";
import { UnlockGate } from "@/components/unlock-gate";
import { listDoctors } from "@/lib/doctorsDb";
import { clinicFeatures } from "@/lib/features";
import { requireSectionPage } from "@/lib/pageAccess";
import { listStaff } from "@/lib/staffDb";

export default async function DoctorsPage() {
  const { locked } = await requireSectionPage("doctors");
  if (locked) return <UnlockGate />;
  const [doctors, staff, features] = await Promise.all([listDoctors(), listStaff(), clinicFeatures()]);
  return (
    <DoctorsManager
      initial={doctors}
      logins={staff.filter((s) => s.role === "doctor").map((s) => ({ id: s.id, name: s.name }))}
      many={features.includes("manyDoctors")}
      shares={features.includes("shares")}
    />
  );
}
