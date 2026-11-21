import { notFound } from "next/navigation";
import { VisitEditor } from "@/components/visits/visit-editor";
import { logActivity } from "@/lib/activity";
import { actorOf, parseId } from "@/lib/api";
import { listDoctors } from "@/lib/doctorsDb";
import { clinicFeatures } from "@/lib/features";
import { listFiles } from "@/lib/filesDb";
import { listMedicines } from "@/lib/medicinesDb";
import { listServices } from "@/lib/moneyDb";
import { requireSectionPage } from "@/lib/pageAccess";
import { getPatient } from "@/lib/patientsDb";
import { requestToday } from "@/lib/settingsDb";
import { getVisit, listOrders } from "@/lib/visitsDb";

export default async function VisitPage({ params }: { params: Promise<{ id: string }> }) {
  const { viewer } = await requireSectionPage("patients");
  if (viewer.clinical === "none") notFound();
  const id = parseId((await params).id);
  if (!id) notFound();
  const visit = await getVisit(id, viewer.clinical);
  if (!visit) notFound();
  const patient = await getPatient(viewer, visit.patientId);
  if (!patient) notFound();
  const features = await clinicFeatures();
  const full = viewer.clinical === "full";
  const rx = full && features.includes("prescriptions");
  const withFiles = full && features.includes("files");
  const fees = viewer.sections.includes("payments");
  const [{ day }, doctors, medicines, orders, files, services] = await Promise.all([
    requestToday(),
    listDoctors(),
    rx ? listMedicines(true) : Promise.resolve([]),
    withFiles ? listOrders(patient.id, id) : Promise.resolve([]),
    withFiles ? listFiles(patient.id).then((list) => list.filter((f) => f.visitId === id)) : Promise.resolve([]),
    fees ? listServices(true) : Promise.resolve([]),
  ]);
  await logActivity(actorOf(viewer), "visit-opened", `visit ${id}`);
  return (
    <VisitEditor
      visit={visit}
      patient={patient}
      today={day}
      doctors={doctors}
      medicines={medicines}
      orders={orders}
      files={files}
      services={services}
      can={{ full, rx, files: withFiles, fees, saveMedicines: rx && viewer.sections.includes("medicines") }}
    />
  );
}
