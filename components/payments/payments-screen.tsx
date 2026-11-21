"use client";

import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PAYMENT_METHODS, type Charge, type Doctor, type PatientSummary, type Payment, type Service } from "@/lib/clinic";
import { addDays, weekdayOf } from "@/lib/format";
import { cn } from "@/lib/utils";
import { FeeDialog, PaymentDialog } from "../clinic/money";
import { useI18n } from "../i18n-provider";
import { PageBody, PageHeader } from "../page-header";
import { MoneyList } from "../patients/patient-file";
import { useShop } from "../shop-provider";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";

export function PaymentsScreen({
  day,
  today,
  charges,
  payments,
  owing,
  services,
  doctors,
  showAlerts,
  canVoid,
}: {
  day: string;
  today: string;
  charges: Charge[];
  payments: Payment[];
  owing: { patientId: number; name: string; fileNo: number; balance: number }[];
  services: Service[];
  doctors: Doctor[];
  showAlerts: boolean;
  canVoid: boolean;
}) {
  const { t, money, day: dayText, dir } = useI18n();
  const m = t.payments;
  const shop = useShop();
  const router = useRouter();
  const [fee, setFee] = useState(false);
  const [paying, setPaying] = useState<{ patient: PatientSummary; balance: number } | null>(null);
  const go = (d: string) => router.push(shop.href(d === today ? "/dashboard/payments" : `/dashboard/payments?day=${d}`));

  const live = charges.filter((c) => !c.voided);
  const paid = payments.filter((p) => !p.voided);
  const billed = live.reduce((s, c) => s + c.amount - c.discount, 0);
  const collected = paid.reduce((s, p) => s + p.amount, 0);
  const byMethod = PAYMENT_METHODS.map((k) => ({ k, sum: paid.filter((p) => p.method === k).reduce((s, p) => s + p.amount, 0) })).filter((x) => x.sum > 0);
  const Prev = dir === "rtl" ? ChevronRightIcon : ChevronLeftIcon;
  const Next = dir === "rtl" ? ChevronLeftIcon : ChevronRightIcon;

  return (
    <PageBody>
      <PageHeader title={m.title} description={`${t.weekdays[weekdayOf(day)]} ${dayText(day)}`}>
        <Button onClick={() => setFee(true)}>
          <PlusIcon />
          {m.addFee}
        </Button>
      </PageHeader>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-full bg-card p-1 shadow-soft">
          <Button variant="ghost" size="icon-sm" aria-label={t.common.previous} onClick={() => go(addDays(day, -1))}>
            <Prev />
          </Button>
          <Button variant={day === today ? "soft" : "ghost"} size="sm" onClick={() => go(today)}>
            {t.common.today}
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label={t.common.next} onClick={() => go(addDays(day, 1))} disabled={day >= today}>
            <Next />
          </Button>
        </div>
        <Input type="date" value={day} max={today} onChange={(e) => e.target.value && go(e.target.value)} className="h-10 w-auto rounded-full" aria-label={t.common.date} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: m.collected, value: money(collected), main: true },
          { label: m.billed, value: money(billed), main: false },
          ...byMethod.map((x) => ({ label: m.methods[x.k], value: money(x.sum), main: false })),
        ].map((s) => (
          <div key={s.label} className={cn("rounded-2xl p-4 shadow-soft", s.main ? "bg-primary text-primary-foreground" : "bg-card")}>
            <p className="tabular truncate text-2xl font-extrabold">{s.value}</p>
            <p className={cn("text-xs font-semibold", s.main ? "opacity-85" : "text-muted-foreground")}>{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-2 lg:col-span-2">
          <MoneyList charges={charges} payments={payments} canVoid={canVoid} onChange={() => router.refresh()} showPatient />
        </Card>
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>{m.owing}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {owing.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{m.nobodyOwes}</p>
            ) : (
              owing.map((o) => (
                <div key={o.patientId} className="flex items-center gap-2 rounded-2xl px-2 py-2">
                  <Link href={shop.href(`/dashboard/patients/${o.patientId}`)} className="min-w-0 flex-1 hover:underline">
                    <span className="block truncate text-sm font-bold">{o.name}</span>
                    <span className="block text-xs text-muted-foreground">{t.patients.fileNo(o.fileNo)}</span>
                  </Link>
                  <span className="tabular text-sm font-extrabold text-accent-700 dark:text-accent-300">{money(o.balance)}</span>
                  <Button
                    size="sm"
                    variant="soft"
                    onClick={() => setPaying({ patient: { id: o.patientId, fileNo: o.fileNo, name: o.name, phone: "", gender: "", birthDate: "", lastVisitAt: null }, balance: o.balance })}
                  >
                    {m.takePayment}
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
      {fee && <FeeDialog open onOpenChange={setFee} services={services} doctors={doctors} today={today} showAlerts={showAlerts} onSaved={() => router.refresh()} />}
      {paying && <PaymentDialog open onOpenChange={(o) => !o && setPaying(null)} patient={paying.patient} balance={paying.balance} onSaved={() => router.refresh()} />}
    </PageBody>
  );
}
