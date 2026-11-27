import { notFound } from "next/navigation";
import { ReceiptPrint } from "@/components/payments/receipt-print";
import { parseId } from "@/lib/api";
import { daySchema } from "@/lib/clinic";
import { listDoctors } from "@/lib/doctorsDb";
import { addDays } from "@/lib/format";
import { moneyBetween, patientMoney } from "@/lib/moneyDb";
import { requireSectionPage } from "@/lib/pageAccess";
import { getPatient } from "@/lib/patientsDb";
import { getPrintSettings, requestToday } from "@/lib/settingsDb";
import { shopProfile } from "@/lib/tenant";

// A receipt for one patient and one day: the fees and payments of that day
// and what they still owe. Nothing medical is on it.
export default async function ReceiptPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ day?: string }> }) {
  const { viewer } = await requireSectionPage("payments");
  const id = parseId((await params).id);
  if (!id) notFound();
  const patient = await getPatient(viewer, id);
  if (!patient) notFound();
  const { day: today } = await requestToday();
  const asked = daySchema.safeParse((await searchParams).day);
  const day = asked.success ? asked.data : today;
  const [money, total, settings, clinic, doctors] = await Promise.all([moneyBetween(day, addDays(day, 1)), patientMoney(id), getPrintSettings(), shopProfile(), listDoctors()]);
  return (
    <ReceiptPrint
      patient={{ id: patient.id, name: patient.name, fileNo: patient.fileNo, phone: patient.phone }}
      day={day}
      today={today}
      charges={money.charges.filter((c) => c.patientId === id && !c.voided)}
      payments={money.payments.filter((p) => p.patientId === id && !p.voided)}
      balance={total.balance}
      doctors={doctors.map((d) => ({ id: d.id, name: d.name }))}
      settings={settings}
      clinic={clinic}
    />
  );
}
