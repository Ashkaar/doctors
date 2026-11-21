import { notFound } from "next/navigation";
import { PrescriptionPrint } from "@/components/visits/prescription-print";
import { parseId } from "@/lib/api";
import { getDoctor } from "@/lib/doctorsDb";
import { hasFeature } from "@/lib/features";
import { requireSectionPage } from "@/lib/pageAccess";
import { getPatient } from "@/lib/patientsDb";
import { getPrintSettings, requestToday } from "@/lib/settingsDb";
import { shopProfile } from "@/lib/tenant";
import { getVisit } from "@/lib/visitsDb";

export default async function PrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { viewer } = await requireSectionPage("patients");
  if (viewer.clinical !== "full" || !(await hasFeature("prescriptions"))) notFound();
  const id = parseId((await params).id);
  if (!id) notFound();
  const visit = await getVisit(id, "full");
  if (!visit) notFound();
  const patient = await getPatient(viewer, visit.patientId);
  if (!patient) notFound();
  const [doctor, settings, profile, { day }] = await Promise.all([getDoctor(visit.doctorId), getPrintSettings(), shopProfile(), requestToday()]);
  return <PrescriptionPrint visit={visit} patient={patient} doctor={doctor} settings={settings} clinic={profile} today={day} />;
}
