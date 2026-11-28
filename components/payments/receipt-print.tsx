"use client";

import { ArrowLeftIcon, PrinterIcon, StethoscopeIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Charge, Payment } from "@/lib/clinic";
import type { PrintSettings } from "@/lib/clinicSettings";
import type { ShopProfile } from "@/lib/tenant";
import { cn } from "@/lib/utils";
import { useI18n } from "../i18n-provider";
import { useShop } from "../shop-provider";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

export function ReceiptPrint({
  patient,
  day,
  today,
  charges,
  payments,
  balance,
  doctors,
  settings,
  clinic,
}: {
  patient: { id: number; name: string; fileNo: number; phone: string };
  day: string;
  today: string;
  charges: Charge[];
  payments: Payment[];
  balance: number;
  doctors: { id: number; name: string }[];
  settings: PrintSettings;
  clinic: ShopProfile;
}) {
  const { t, money, day: dayText, time } = useI18n();
  const r = t.receipt;
  const shop = useShop();
  const router = useRouter();
  const a5 = settings.paper === "a5";
  const billed = charges.reduce((s, c) => s + c.amount - c.discount, 0);
  const discounts = charges.reduce((s, c) => s + c.discount, 0);
  const number = `${patient.fileNo}-${day.replaceAll("-", "")}`;
  const doctorName = (id: number | null) => doctors.find((d) => d.id === id)?.name ?? "";

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 print:p-0">
      <style>{`@media print { @page { size: ${a5 ? "A5" : "A4"}; margin: ${a5 ? "9mm" : "14mm"}; } html, body { background: var(--color-paper) !important; } main { padding: 0 !important; } }`}</style>
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2">
        <Button asChild variant="ghost">
          <Link href={shop.href(`/dashboard/patients/${patient.id}`)}>
            <ArrowLeftIcon className="rtl:-scale-x-100" />
            {r.back}
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={day}
            max={today}
            onChange={(e) => e.target.value && router.push(shop.href(`/dashboard/patients/${patient.id}/receipt?day=${e.target.value}`))}
            className="h-10 w-auto rounded-full"
            aria-label={t.common.date}
          />
          <Button onClick={() => window.print()} disabled={charges.length + payments.length === 0}>
            <PrinterIcon />
            {t.common.print}
          </Button>
        </div>
      </div>

      <article
        className={cn(
          "mx-auto flex flex-col rounded-2xl bg-paper text-paper-ink shadow-soft print:rounded-none print:shadow-none",
          a5 ? "max-w-[148mm] p-[9mm] text-[12px] print:max-w-none print:p-0" : "max-w-[210mm] p-[14mm] text-[13px] print:max-w-none print:p-0",
        )}
      >
        <header className="flex items-start gap-4 border-b-2 border-brand-700 pb-3">
          <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-700 text-paper">
            {clinic.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- the logo is served by Ariloo
              <img src={clinic.logoUrl} alt="" className="size-full object-cover" />
            ) : (
              <StethoscopeIcon className="size-5" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[1.4em] font-extrabold leading-tight">{clinic.name}</p>
            {clinic.branch && <p className="font-semibold opacity-75">{clinic.branch}</p>}
            {settings.header && <p className="mt-0.5 whitespace-pre-line opacity-75">{settings.header}</p>}
          </div>
          <div className="text-end">
            <p className="text-[1.2em] font-extrabold">{r.title}</p>
            <p className="tabular opacity-70" dir="ltr">
              № {number}
            </p>
          </div>
        </header>

        <dl className="mt-3 grid grid-cols-[auto_1fr_auto_auto] gap-x-3 gap-y-1">
          <dt className="opacity-60">{t.print.patient}</dt>
          <dd className="font-bold">{patient.name}</dd>
          <dt className="opacity-60">{t.print.date}</dt>
          <dd className="font-bold">{dayText(day)}</dd>
          <dt className="opacity-60">{t.print.fileNo}</dt>
          <dd className="tabular font-bold">{patient.fileNo}</dd>
          {patient.phone && (
            <>
              <dt className="opacity-60">{t.patients.phone}</dt>
              <dd className="font-bold" dir="ltr">
                {patient.phone}
              </dd>
            </>
          )}
        </dl>

        {charges.length + payments.length === 0 ? (
          <p className="no-print mt-8 text-center opacity-60">{r.nothing}</p>
        ) : (
          <>
            <table className="mt-4 w-full">
              <thead>
                <tr className="border-b border-paper-line text-start opacity-60">
                  <th className="py-1.5 text-start font-semibold">{r.item}</th>
                  <th className="py-1.5 text-end font-semibold">{r.amount}</th>
                </tr>
              </thead>
              <tbody>
                {charges.map((c) => (
                  <tr key={c.id} className="border-b border-paper-line">
                    <td className="py-1.5">
                      <span className="font-bold">{c.description}</span>
                      {c.doctorId && doctors.length > 1 && <span className="opacity-60"> · {doctorName(c.doctorId)}</span>}
                      {c.discount > 0 && <span className="block text-[0.9em] opacity-60">{r.discountOf(money(c.discount))}</span>}
                    </td>
                    <td className="tabular py-1.5 text-end font-bold">{money(c.amount - c.discount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <dl className="ms-auto mt-3 w-full max-w-64 space-y-1">
              {discounts > 0 && (
                <div className="flex justify-between gap-4">
                  <dt className="opacity-60">{t.payments.discount}</dt>
                  <dd className="tabular">−{money(discounts)}</dd>
                </div>
              )}
              <div className="flex justify-between gap-4 font-bold">
                <dt>{r.fees}</dt>
                <dd className="tabular">{money(billed)}</dd>
              </div>
              {payments.map((p) => (
                <div key={p.id} className="flex justify-between gap-4">
                  <dt className="opacity-60">
                    {r.paid} · {t.payments.methods[p.method]} · <span dir="ltr">{time(p.at)}</span>
                  </dt>
                  <dd className="tabular">{money(p.amount)}</dd>
                </div>
              ))}
              <div className="flex justify-between gap-4 border-t-2 border-paper-ink pt-1.5 text-[1.15em] font-extrabold">
                <dt>{balance > 0 ? r.stillOwed : r.allPaid}</dt>
                <dd className="tabular">{money(Math.max(0, balance))}</dd>
              </div>
            </dl>
          </>
        )}

        <footer className="mt-8 flex items-end justify-between gap-4 border-t border-paper-line pt-3">
          <p className="whitespace-pre-line opacity-60">{settings.footer || r.thanks}</p>
          <p className="w-36 border-t border-dashed border-current pt-1 text-center opacity-60">{t.print.signature}</p>
        </footer>
      </article>
    </div>
  );
}
