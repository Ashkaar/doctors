import { PatientList } from "@/components/patients/patient-list";
import { requireSectionPage } from "@/lib/pageAccess";
import { searchPatients } from "@/lib/patientsDb";
import { requestToday } from "@/lib/settingsDb";

export default async function PatientsPage() {
  const { viewer } = await requireSectionPage("patients");
  const [patients, { day }] = await Promise.all([searchPatients(viewer, "", 50), requestToday()]);
  return <PatientList initial={patients} today={day} showAlerts={viewer.clinical !== "none"} />;
}
