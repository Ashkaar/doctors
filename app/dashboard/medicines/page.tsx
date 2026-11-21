import { notFound } from "next/navigation";
import { MedicinesManager } from "@/components/medicines-manager";
import { hasFeature } from "@/lib/features";
import { listMedicines } from "@/lib/medicinesDb";
import { requireSectionPage } from "@/lib/pageAccess";

export default async function MedicinesPage() {
  const { viewer } = await requireSectionPage("medicines");
  if (viewer.clinical !== "full" || !(await hasFeature("prescriptions"))) notFound();
  return <MedicinesManager initial={await listMedicines()} />;
}
