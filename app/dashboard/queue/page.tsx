import { QueueScreen } from "@/components/queue/queue-screen";
import { listDoctors } from "@/lib/doctorsDb";
import { requireSectionPage } from "@/lib/pageAccess";
import { listQueue } from "@/lib/scheduleDb";
import { requestToday } from "@/lib/settingsDb";

export default async function QueuePage() {
  const { viewer } = await requireSectionPage("queue");
  const { day } = await requestToday();
  const mine = viewer.ownPatientsOnly ? (viewer.doctorId ?? -1) : undefined;
  const [doctors, queue] = await Promise.all([listDoctors(true), listQueue(day, mine)]);
  return (
    <QueueScreen
      day={day}
      doctors={viewer.ownPatientsOnly ? doctors.filter((d) => d.id === viewer.doctorId) : doctors}
      initial={queue}
      myDoctorId={viewer.doctorId}
      canVisit={viewer.clinical !== "none" && viewer.sections.includes("patients")}
      showAlerts={viewer.clinical !== "none"}
      isOwner={viewer.isOwner}
    />
  );
}
