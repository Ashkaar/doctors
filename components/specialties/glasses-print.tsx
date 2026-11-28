"use client";

import { ArrowLeftIcon, PrinterIcon, StethoscopeIcon } from "lucide-react";
import Link from "next/link";
import type { Doctor } from "@/lib/clinic";
import type { PrintSettings } from "@/lib/clinicSettings";
import { formatPower, type EyeExam } from "@/lib/specialties";
import type { ShopProfile } from "@/lib/tenant";
import { cn } from "@/lib/utils";
import { useI18n } from "../i18n-provider";
import { useShop } from "../shop-provider";
import { Button } from "../ui/button";

export function GlassesPrint({ visitId, at, patient, exam, doctor, settings, clinic }: { visitId: number; at: number; patient: { name: string; fileNo: number }; exam: EyeExam; doctor: Doctor | null; settings: PrintSettings; clinic: ShopProfile }) {
  const { t, date } = useI18n();
  const e = t.eye;
  const shop = useShop();
  const a5 = settings.paper === "a5";
  const cell = "border border-paper-line px-2 py-1.5 text-center tabular";
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 print:p-0">
      <style>{`@media print { @page { size: ${a5 ? "A5 landscape" : "A4"}; margin: ${a5 ? "9mm" : "14mm"}; } html, body { background: var(--color-paper) !important; } main { padding: 0 !important; } }`}</style>
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2">
        <Button asChild variant="ghost">
          <Link href={shop.href(`/dashboard/visits/${visitId}`)}>
            <ArrowLeftIcon className="rtl:-scale-x-100" />
            {t.print.back}
          </Link>
        </Button>
        <Button onClick={() => window.print()}>
          <PrinterIcon />
          {t.common.print}
        </Button>
      </div>
      <article className={cn("mx-auto rounded-2xl bg-paper text-paper-ink shadow-soft print:rounded-none print:shadow-none", a5 ? "max-w-[210mm] p-[9mm] text-[12px] print:p-0" : "max-w-[210mm] p-[14mm] text-[13px] print:p-0")}>
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
          {doctor && (
            <div className="text-end">
              <p className="font-extrabold">{doctor.name}</p>
              {doctor.specialty && <p className="opacity-75">{doctor.specialty}</p>}
              {doctor.licence && <p className="opacity-60">{t.print.licence(doctor.licence)}</p>}
            </div>
          )}
        </header>
        <p className="mt-3 text-[1.2em] font-extrabold">{e.glassesTitle}</p>
        <p className="mt-1">
          <span className="opacity-60">{t.print.patient}: </span>
          <span className="font-bold">{patient.name}</span>
          <span className="opacity-60"> · {t.print.fileNo} </span>
          <span className="tabular font-bold">{patient.fileNo}</span>
          <span className="opacity-60"> · {t.print.date} </span>
          <span className="font-bold">{date(at)}</span>
        </p>
        <table className="mt-4 w-full border-collapse" dir="ltr">
          <thead>
            <tr className="font-bold">
              <th className={cell} />
              <th className={cell}>SPH</th>
              <th className={cell}>CYL</th>
              <th className={cell}>AXIS</th>
              <th className={cell}>ADD</th>
              <th className={cell}>VA</th>
            </tr>
          </thead>
          <tbody>
            {(["od", "os"] as const).map((k) => (
              <tr key={k}>
                <th className={cn(cell, "font-extrabold")}>{k === "od" ? `OD · ${e.right}` : `OS · ${e.left}`}</th>
                <td className={cell}>{formatPower(exam[k].sph) || "—"}</td>
                <td className={cell}>{formatPower(exam[k].cyl) || "—"}</td>
                <td className={cell}>{exam[k].axis ?? "—"}</td>
                <td className={cell}>{exam[k].add ? formatPower(exam[k].add) : "—"}</td>
                <td className={cell}>{exam[k].vaCorrected || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {exam.pd !== null && (
          <p className="mt-3">
            <span className="opacity-60">{e.pd}: </span>
            <span className="tabular font-bold">{exam.pd} mm</span>
          </p>
        )}
        {exam.notes && <p className="mt-2 whitespace-pre-line">{exam.notes}</p>}
        <footer className="mt-10 flex items-end justify-between gap-4 border-t border-paper-line pt-3">
          <p className="whitespace-pre-line opacity-60">{settings.footer}</p>
          <p className="w-40 border-t border-dashed border-current pt-1 text-center opacity-60">{t.print.signature}</p>
        </footer>
      </article>
    </div>
  );
}
