import { DashboardHome, type Subscription } from "@/components/dashboard-home";
import { listDoctors } from "@/lib/doctorsDb";
import { moneyBetween } from "@/lib/moneyDb";
import { addDays } from "@/lib/format";
import { requireSectionPage } from "@/lib/pageAccess";
import { countPatients } from "@/lib/patientsDb";
import { listAppointments, listQueue } from "@/lib/scheduleDb";
import { listServices } from "@/lib/moneyDb";
import { requestToday } from "@/lib/settingsDb";
import { accountUrl, currentShop } from "@/lib/tenant";

export default async function DashboardPage() {
  const { viewer } = await requireSectionPage("dashboard");
  const shop = await currentShop();
  const { day } = await requestToday();
  // A doctor who sees only their own patients sees only their own day.
  const mine = viewer.ownPatientsOnly ? (viewer.doctorId ?? -1) : undefined;
  const [doctors, appointments, queue, money, patients, services] = await Promise.all([
    listDoctors(true),
    viewer.sections.includes("appointments") ? listAppointments(day, mine) : Promise.resolve([]),
    viewer.sections.includes("queue") ? listQueue(day, mine) : Promise.resolve([]),
    viewer.sections.includes("payments") ? moneyBetween(day, addDays(day, 1)) : Promise.resolve(null),
    viewer.isOwner ? countPatients() : Promise.resolve(0),
    viewer.isOwner ? listServices() : Promise.resolve([]),
  ]);
  const subscription: Subscription | null =
    shop && viewer.kind === "owner" ? { state: shop.state, plan: shop.plan, trialEndsAt: shop.trialEndsAt, paidUntil: shop.paidUntil, accountUrl: accountUrl() } : null;
  const feesToday = money ? money.charges.filter((c) => !c.voided).reduce((s, c) => s + c.amount - c.discount, 0) : null;
  const setup = viewer.isOwner ? { doctors: doctors.length > 0, services: services.length > 0, patients: patients > 0 } : null;
  return (
    <DashboardHome
      viewer={viewer}
      subscription={subscription}
      day={day}
      doctors={doctors}
      appointments={appointments}
      queue={queue}
      feesToday={feesToday}
      setup={setup}
    />
  );
}
