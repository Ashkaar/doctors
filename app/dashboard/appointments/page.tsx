import { AppointmentsScreen } from "@/components/appointments/appointments-screen";
import { listDoctors } from "@/lib/doctorsDb";
import { requireSectionPage } from "@/lib/pageAccess";
import { listAppointments } from "@/lib/scheduleDb";
import { getHours, requestToday } from "@/lib/settingsDb";

export default async function AppointmentsPage() {
  const { viewer } = await requireSectionPage("appointments");
  const { day } = await requestToday();
  const mine = viewer.ownPatientsOnly ? (viewer.doctorId ?? -1) : undefined;
  const [doctors, appointments, hours] = await Promise.all([listDoctors(true), listAppointments(day, mine), getHours()]);
  return (
    <AppointmentsScreen
      today={day}
      doctors={viewer.ownPatientsOnly ? doctors.filter((d) => d.id === viewer.doctorId) : doctors}
      initial={appointments}
      hours={hours}
      showAlerts={viewer.clinical !== "none"}
      canQueue={viewer.sections.includes("queue")}
      isOwner={viewer.isOwner}
    />
  );
}
