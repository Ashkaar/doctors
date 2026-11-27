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
import { getClinicTypes, getHours, requestToday } from "@/lib/settingsDb";
import { growthPoints, listChecks, listEyeExams, listPregnancies, listTeeth, listVaccinations, listWork } from "@/lib/specialtiesDb";
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
  const [{ day }, hours, doctors, visits, appointments, files, orders, money, services, withRx] = await Promise.all([
    requestToday(),
    getHours(),
    listDoctors(),
    listVisits(id, viewer.clinical),
    viewer.sections.includes("appointments") ? patientAppointments(id) : Promise.resolve([]),
    withFiles ? listFiles(id) : Promise.resolve([]),
    withFiles ? listOrders(id) : Promise.resolve([]),
    withFees ? patientMoney(id) : Promise.resolve(null),
    withFees ? listServices(true) : Promise.resolve([]),
    full ? visitsWithPrescription(id) : Promise.resolve(new Set<number>()),
  ]);
  // The clinic's kind decides which charts the file shows.
  const types = (await getClinicTypes()) ?? ["general"];
  const show = {
    teeth: types.includes("dental") && full,
    eyes: types.includes("eye") && full,
    growth: types.includes("children") && viewer.clinical !== "none",
    pregnancy: types.includes("womens") && full && patient.gender !== "m",
  };
  const [teeth, work, eyeExams, growth, vaccines, pregnancies] = await Promise.all([
    show.teeth ? listTeeth(id) : Promise.resolve([]),
    show.teeth ? listWork(id) : Promise.resolve([]),
    show.eyes ? listEyeExams(id) : Promise.resolve([]),
    show.growth ? growthPoints(id) : Promise.resolve([]),
    show.growth ? listVaccinations(id) : Promise.resolve([]),
    show.pregnancy ? listPregnancies(id).then((list) => Promise.all(list.map(async (p) => ({ ...p, checks: await listChecks(p.id) })))) : Promise.resolve([]),
  ]);
  await logActivity(actorOf(viewer), "patient-opened", `#${patient.fileNo}`);
  return (
    <PatientFile
      patient={patient}
      today={day}
      hours={hours}
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
      specialty={{ show, teeth, work, eyeExams, growth, vaccines, pregnancies }}
    />
  );
}
