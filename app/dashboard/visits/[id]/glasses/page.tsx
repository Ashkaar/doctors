import { notFound } from "next/navigation";
import { GlassesPrint } from "@/components/specialties/glasses-print";
import { parseId } from "@/lib/api";
import { getDoctor } from "@/lib/doctorsDb";
import { requireSectionPage } from "@/lib/pageAccess";
import { getPatient } from "@/lib/patientsDb";
import { getPrintSettings } from "@/lib/settingsDb";
import { getEyeExam } from "@/lib/specialtiesDb";
import { shopProfile } from "@/lib/tenant";
import { getVisit } from "@/lib/visitsDb";

// A glasses prescription from the visit's eye exam.
export default async function GlassesPage({ params }: { params: Promise<{ id: string }> }) {
  const { viewer } = await requireSectionPage("patients");
  if (viewer.clinical !== "full") notFound();
  const id = parseId((await params).id);
  if (!id) notFound();
  const visit = await getVisit(id, "full");
  if (!visit) notFound();
  const [patient, exam] = await Promise.all([getPatient(viewer, visit.patientId), getEyeExam(id)]);
  if (!patient || !exam) notFound();
  const [doctor, settings, clinic] = await Promise.all([getDoctor(visit.doctorId), getPrintSettings(), shopProfile()]);
  return <GlassesPrint visitId={id} at={visit.at} patient={{ name: patient.name, fileNo: patient.fileNo }} exam={exam} doctor={doctor} settings={settings} clinic={clinic} />;
}
