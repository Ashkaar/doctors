"use client";

import { ArrowLeftIcon, PrinterIcon, StethoscopeIcon } from "lucide-react";
import Link from "next/link";
import { ageOn, type Doctor, type Patient, type Visit } from "@/lib/clinic";
import type { PrintSettings } from "@/lib/clinicSettings";
import type { ShopProfile } from "@/lib/tenant";
import { cn } from "@/lib/utils";
import { useI18n } from "../i18n-provider";
import { useShop } from "../shop-provider";
import { Button } from "../ui/button";

// The prescription as printed: the clinic's logo and name, the doctor, the
// patient, the medicines and the doctor's notes. A5 or A4 (Settings).
export function PrescriptionPrint({
  visit,
  patient,
  doctor,
  settings,
  clinic,
  today,
}: {
  visit: Visit;
  patient: Patient;
  doctor: Doctor | null;
  settings: PrintSettings;
  clinic: ShopProfile;
  today: string;
}) {
  const { t, date } = useI18n();
  const pr = t.print;
  const shop = useShop();
  const age = patient.birthDate ? ageOn(patient.birthDate, today) : null;
  const a5 = settings.paper === "a5";

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 print:p-0">
      <style>{`@media print { @page { size: ${a5 ? "A5" : "A4"}; margin: ${a5 ? "9mm" : "14mm"}; } html, body { background: var(--color-paper) !important; } main { padding: 0 !important; } }`}</style>
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2">
        <Button asChild variant="ghost">
          <Link href={shop.href(`/dashboard/visits/${visit.id}`)}>
            <ArrowLeftIcon className="rtl:-scale-x-100" />
            {pr.back}
          </Link>
        </Button>
        <Button onClick={() => window.print()}>
          <PrinterIcon />
          {t.common.print}
        </Button>
      </div>

      <article
        className={cn(
          "mx-auto flex flex-col bg-paper text-paper-ink shadow-soft print:shadow-none",
          a5 ? "aspect-[148/210] max-w-[148mm] p-[9mm] text-[12px] print:aspect-auto print:max-w-none print:p-0" : "aspect-[210/297] max-w-[210mm] p-[14mm] text-[13px] print:aspect-auto print:max-w-none print:p-0",
          "rounded-2xl print:rounded-none",
        )}
      >
        <header className="flex items-start gap-4 border-b-2 border-brand-700 pb-3">
          <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-700 text-paper">
            {clinic.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- the logo is served by Ariloo
              <img src={clinic.logoUrl} alt="" className="size-full object-cover" />
            ) : (
              <StethoscopeIcon className="size-6" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[1.5em] font-extrabold leading-tight">{clinic.name}</p>
            {clinic.branch && <p className="font-semibold opacity-75">{clinic.branch}</p>}
            {settings.header && <p className="mt-0.5 whitespace-pre-line opacity-75">{settings.header}</p>}
          </div>
          {doctor && (
            <div className="text-end">
              <p className="font-extrabold">{doctor.name}</p>
              {doctor.specialty && <p className="opacity-75">{doctor.specialty}</p>}
              {doctor.licence && <p className="opacity-60">{pr.licence(doctor.licence)}</p>}
            </div>
          )}
        </header>

        <dl className="mt-3 grid grid-cols-[auto_1fr_auto_auto] gap-x-3 gap-y-1">
          <dt className="opacity-60">{pr.patient}</dt>
          <dd className="font-bold">{patient.name}</dd>
          <dt className="opacity-60">{pr.date}</dt>
          <dd className="font-bold">{date(visit.at)}</dd>
          {age !== null && (
            <>
              <dt className="opacity-60">{pr.age}</dt>
              <dd className="font-bold">{t.patients.age(age)}</dd>
            </>
          )}
          <dt className="opacity-60">{pr.fileNo}</dt>
          <dd className="tabular font-bold">{patient.fileNo}</dd>
        </dl>
        {visit.diagnosis && (
          <p className="mt-2">
            <span className="opacity-60">{pr.diagnosis}: </span>
            <span className="font-semibold">{visit.diagnosis}</span>
          </p>
        )}

        <p className="mt-4 text-[2em] font-extrabold italic leading-none text-brand-700" dir="ltr">
          ℞
        </p>
        <ol className="mt-2 flex-1 space-y-3">
          {visit.items.map((item, i) => (
            <li key={i} className="flex gap-3">
              <span className="tabular font-extrabold">{i + 1}.</span>
              <div className="min-w-0">
                <p className="text-[1.1em] font-extrabold" dir="auto">
                  {item.medicine}
                </p>
                <p dir="auto">{[item.dose, item.frequency, item.duration].filter(Boolean).join(" · ")}</p>
                {item.notes && (
                  <p className="opacity-75" dir="auto">
                    {item.notes}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
        {visit.rxNotes && <p className="mt-3 whitespace-pre-line rounded-lg bg-paper-soft p-2">{visit.rxNotes}</p>}
        {visit.followUp && (
          <p className="mt-2">
            <span className="opacity-60">{pr.followUp}: </span>
            <span className="font-semibold">{visit.followUp}</span>
          </p>
        )}

        <footer className="mt-6 flex items-end justify-between gap-4 border-t border-paper-line pt-3">
          <p className="whitespace-pre-line opacity-60">{settings.footer}</p>
          <p className="w-40 border-t border-dashed border-current pt-1 text-center opacity-60">{pr.signature}</p>
        </footer>
      </article>
    </div>
  );
}
