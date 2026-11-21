import { notFound } from "next/navigation";
import { PatientFile } from "@/components/patients/patient-file";
import { logActivity } from "@/lib/activity";
import { actorOf, parseId } from "@/lib/api";
import { listDoctors } from "@/lib/doctorsDb";
import { clinicFeatures } from "@/lib/features";
import { listFiles } from "@/lib/filesDb";
import { listServices, patientMoney } from "@/lib/moneyDb";
import { requireSectionPage } from "@/lib/pageAccess";
import { getPatient } from "@/lib/patientsDb";
import { patientAppointments } from "@/lib/scheduleDb";
import { requestToday } from "@/lib/settingsDb";
import { listOrders, listVisits, visitsWithPrescription } from "@/lib/visitsDb";

export default async function PatientPage({ params }: { params: Promise<{ id: string }> }) {
  const { viewer } = await requireSectionPage("patients");
  const id = parseId((await params).id);
  if (!id) notFound();
  const patient = await getPatient(viewer, id);
  if (!patient) notFound();
  const features = await clinicFeatures();
  const full = viewer.clinical === "full";
  const withFiles = full && features.includes("files");
  const withFees = viewer.sections.includes("payments");
  const [{ day }, doctors, visits, appointments, files, orders, money, services, withRx] = await Promise.all([
    requestToday(),
    listDoctors(),
    listVisits(id, viewer.clinical),
    viewer.sections.includes("appointments") ? patientAppointments(id) : Promise.resolve([]),
    withFiles ? listFiles(id) : Promise.resolve([]),
    withFiles ? listOrders(id) : Promise.resolve([]),
    withFees ? patientMoney(id) : Promise.resolve(null),
    withFees ? listServices(true) : Promise.resolve([]),
    full ? visitsWithPrescription(id) : Promise.resolve(new Set<number>()),
  ]);
  await logActivity(actorOf(viewer), "patient-opened", `#${patient.fileNo}`);
  return (
    <PatientFile
      patient={patient}
      today={day}
      doctors={doctors}
      visits={visits}
      rxVisitIds={[...withRx]}
      appointments={appointments}
      files={files}
      orders={orders}
      money={money}
      services={services}
      can={{
        alerts: viewer.clinical !== "none",
        visit: viewer.clinical !== "none",
        full,
        files: withFiles,
        fees: withFees,
        book: viewer.sections.includes("appointments"),
        queue: viewer.sections.includes("queue"),
        owner: viewer.isOwner,
        export: viewer.isOwner && features.includes("export"),
        void: viewer.isOwner,
      }}
      myDoctorId={viewer.doctorId}
    />
  );
}
