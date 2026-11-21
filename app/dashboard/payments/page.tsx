import { PaymentsScreen } from "@/components/payments/payments-screen";
import { daySchema } from "@/lib/clinic";
import { listDoctors } from "@/lib/doctorsDb";
import { addDays } from "@/lib/format";
import { balancesOwed, listServices, moneyBetween } from "@/lib/moneyDb";
import { requireSectionPage } from "@/lib/pageAccess";
import { requestToday } from "@/lib/settingsDb";

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  const { viewer } = await requireSectionPage("payments");
  const { day: today } = await requestToday();
  const asked = daySchema.safeParse((await searchParams).day);
  const day = asked.success ? asked.data : today;
  const [money, owing, services, doctors] = await Promise.all([moneyBetween(day, addDays(day, 1)), balancesOwed(), listServices(true), listDoctors(true)]);
  return (
    <PaymentsScreen
      day={day}
      today={today}
      charges={money.charges}
      payments={money.payments}
      owing={owing}
      services={services}
      doctors={doctors}
      showAlerts={viewer.clinical !== "none"}
      canVoid={viewer.isOwner}
    />
  );
}
