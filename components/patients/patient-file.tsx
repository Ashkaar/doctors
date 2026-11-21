"use client";

import {
  CalendarPlusIcon,
  DownloadIcon,
  FileTextIcon,
  ListPlusIcon,
  PencilIcon,
  PillIcon,
  StethoscopeIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  ageOn,
  minutesToTime,
  type Appointment,
  type Charge,
  type Doctor,
  type Order,
  type Patient,
  type PatientFile as PatientFileRecord,
  type Payment,
  type Service,
  type VisitSummary,
} from "@/lib/clinic";
import { errorMessage, sendJson } from "@/lib/clientApi";
import { cn } from "@/lib/utils";
import { BookDialog, DoctorSelect, WalkInDialog } from "../clinic/booking";
import { Field } from "../clinic/fields";
import { FeeDialog, PaymentDialog } from "../clinic/money";
import { ConfirmDialog } from "../confirm-dialog";
import { useI18n } from "../i18n-provider";
import { PageBody } from "../page-header";
import { useShop } from "../shop-provider";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { FilesPanel } from "./files-panel";
import { PatientDialog } from "./patient-form";

type Tab = "visits" | "appointments" | "files" | "fees";

export interface PatientAbilities {
  alerts: boolean;
  visit: boolean;
  full: boolean;
  files: boolean;
  fees: boolean;
  book: boolean;
  queue: boolean;
  owner: boolean;
  export: boolean;
  void: boolean;
}

export function PatientFile({
  patient,
  today,
  doctors,
  visits,
  rxVisitIds,
  appointments,
  files,
  orders,
  money,
  services,
  can,
  myDoctorId,
}: {
  patient: Patient;
  today: string;
  doctors: Doctor[];
  visits: VisitSummary[];
  rxVisitIds: number[];
  appointments: Appointment[];
  files: PatientFileRecord[];
  orders: Order[];
  money: { charges: Charge[]; payments: Payment[]; balance: number } | null;
  services: Service[];
  can: PatientAbilities;
  myDoctorId: number | null;
}) {
  const { t, date, dateTime, money: fmt, day: dayText } = useI18n();
  const p = t.patients;
  const shop = useShop();
  const router = useRouter();
  const tabs: Tab[] = ["visits", ...(can.book ? (["appointments"] as Tab[]) : []), ...(can.files ? (["files"] as Tab[]) : []), ...(can.fees ? (["fees"] as Tab[]) : [])];
  const [tab, setTab] = useState<Tab>("visits");
  const [dialog, setDialog] = useState<null | "edit" | "book" | "queue" | "fee" | "payment" | "delete" | "visit">(null);
  const active = doctors.filter((d) => d.active);
  const [visitDoctor, setVisitDoctor] = useState<number | null>(myDoctorId ?? (active.length === 1 ? active[0].id : null));
  const [busy, setBusy] = useState(false);
  const age = patient.birthDate ? ageOn(patient.birthDate, today) : null;
  const doctorName = (id: number | null) => doctors.find((d) => d.id === id)?.name ?? "";
  const refresh = () => router.refresh();
  const hasAlerts = Boolean(patient.allergies?.trim() || patient.conditions?.trim());

  const startVisit = async () => {
    if (!visitDoctor) return;
    setBusy(true);
    try {
      const { id } = await sendJson<{ id: number }>("/api/visits", "POST", { patientId: patient.id, doctorId: visitDoctor });
      router.push(shop.href(`/dashboard/visits/${id}`));
    } catch (err) {
      toast.error(errorMessage(err, t.common.somethingWrong));
      setBusy(false);
    }
  };

  const facts: [string, string][] = [
    [p.phone, patient.phone],
    [p.gender, patient.gender ? p.genders[patient.gender] : ""],
    [p.birth, /^\d{4}-\d{2}-\d{2}$/.test(patient.birthDate) ? dayText(patient.birthDate) : patient.birthDate],
    [p.bloodGroup, patient.bloodGroup],
    [p.address, patient.address],
  ].filter(([, v]) => v) as [string, string][];

  return (
    <PageBody>
      <div className="flex flex-wrap items-start gap-4">
        <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary text-2xl font-extrabold text-primary-foreground">{patient.name.slice(0, 1)}</span>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-[28px]">{patient.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {p.fileNo(patient.fileNo)}
            {patient.gender && ` · ${p.genders[patient.gender]}`}
            {age !== null && ` · ${p.age(age)}`}
            {patient.bloodGroup && ` · ${patient.bloodGroup}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {can.visit && active.length > 0 && (
            <Button onClick={() => (myDoctorId || active.length === 1 ? startVisit() : setDialog("visit"))} disabled={busy}>
              <StethoscopeIcon />
              {p.newVisit}
            </Button>
          )}
          {can.queue && active.length > 0 && (
            <Button variant="outline" onClick={() => setDialog("queue")}>
              <ListPlusIcon />
              {p.toQueue}
            </Button>
          )}
          {can.book && active.length > 0 && (
            <Button variant="outline" onClick={() => setDialog("book")}>
              <CalendarPlusIcon />
              {p.book}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4">
          {can.alerts && (
            <div className={cn("rounded-2xl p-4", hasAlerts ? "bg-accent-100 text-accent-950 dark:bg-accent-500/15 dark:text-accent-100" : "bg-card shadow-soft")}>
              <p className="flex items-center gap-2 text-sm font-extrabold">
                <TriangleAlertIcon className={cn("size-4", hasAlerts ? "text-accent-700 dark:text-accent-300" : "text-muted-foreground")} />
                {p.alerts}
              </p>
              {hasAlerts ? (
                <dl className="mt-2 space-y-2 text-sm">
                  {patient.allergies?.trim() && (
                    <div>
                      <dt className="text-xs font-bold opacity-75">{p.allergies}</dt>
                      <dd className="whitespace-pre-line font-semibold">{patient.allergies}</dd>
                    </div>
                  )}
                  {patient.conditions?.trim() && (
                    <div>
                      <dt className="text-xs font-bold opacity-75">{p.conditions}</dt>
                      <dd className="whitespace-pre-line font-semibold">{patient.conditions}</dd>
                    </div>
                  )}
                </dl>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">{p.noAlerts}</p>
              )}
            </div>
          )}
          <Card>
            <CardHeader className="items-center">
              <CardTitle>{p.details}</CardTitle>
              <Button variant="ghost" size="icon-sm" aria-label={t.common.edit} onClick={() => setDialog("edit")}>
                <PencilIcon />
              </Button>
            </CardHeader>
            <CardContent className="space-y-3 pt-3">
              <dl className="space-y-2 text-sm">
                {facts.map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="text-end font-semibold" dir={label === p.phone ? "ltr" : undefined}>
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
              {patient.notes && <p className="whitespace-pre-line rounded-xl bg-muted/60 p-3 text-sm">{patient.notes}</p>}
              <p className="text-xs text-muted-foreground">{p.since(date(patient.createdAt))}</p>
            </CardContent>
          </Card>
          {can.owner && (
            <Card>
              <CardHeader>
                <CardTitle>{p.ownerActions}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {can.export && (
                  <Button asChild variant="outline" size="sm">
                    <a href={shop.href(`/api/patients/${patient.id}/export`)}>
                      <DownloadIcon />
                      {p.export}
                    </a>
                  </Button>
                )}
                <Button variant="destructive-ghost" size="sm" onClick={() => setDialog("delete")}>
                  <Trash2Icon />
                  {t.common.delete}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4 lg:col-span-2">
          {tabs.length > 1 && (
            <div role="tablist" className="flex gap-2 overflow-x-auto">
              {tabs.map((x) => (
                <button
                  key={x}
                  type="button"
                  role="tab"
                  aria-selected={tab === x}
                  onClick={() => setTab(x)}
                  className={cn("h-9 shrink-0 cursor-pointer rounded-full px-4 text-sm font-bold", tab === x ? "bg-card text-foreground shadow-soft" : "text-muted-foreground hover:text-foreground")}
                >
                  {p.tabs[x]}
                </button>
              ))}
            </div>
          )}

          {tab === "visits" && (
            <Card className="p-2">
              {visits.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">{t.visits.none}</p>
              ) : (
                <ul className="space-y-1">
                  {visits.map((v) => {
                    const body = (
                      <>
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-soft-foreground">
                          <StethoscopeIcon className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-bold">{v.diagnosis || dateTime(v.at)}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {v.diagnosis ? `${date(v.at)} · ` : ""}
                            {t.visits.withDoctor(doctorName(v.doctorId))}
                          </span>
                        </span>
                        {rxVisitIds.includes(v.id) && <PillIcon className="size-4 text-muted-foreground" aria-label={t.visits.rx} />}
                      </>
                    );
                    return (
                      <li key={v.id}>
                        {can.visit ? (
                          <Link href={shop.href(`/dashboard/visits/${v.id}`)} className="flex items-center gap-3 rounded-2xl px-3 py-3 hover:bg-muted/60">
                            {body}
                          </Link>
                        ) : (
                          <div className="flex items-center gap-3 rounded-2xl px-3 py-3">{body}</div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              {!can.visit && <p className="px-3 pb-3 text-xs text-muted-foreground">{t.visits.noRecord}</p>}
            </Card>
          )}

          {tab === "appointments" && (
            <Card className="p-2">
              {appointments.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">{t.appointments.none}</p>
              ) : (
                <ul className="space-y-1">
                  {appointments.map((a) => (
                    <li key={a.id} className="flex items-center gap-3 rounded-2xl px-3 py-3">
                      <span className="min-w-0 flex-1">
                        <span className="block font-bold">
                          {dayText(a.day)} · <span dir="ltr">{minutesToTime(a.startMin)}</span>
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">{[doctorName(a.doctorId), a.reason].filter(Boolean).join(" · ")}</span>
                      </span>
                      <Badge variant={a.status === "cancelled" ? "destructive" : a.status === "noShow" ? "accent" : "neutral"}>{t.appointments.statuses[a.status]}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          {tab === "files" && <FilesPanel patientId={patient.id} files={files} orders={orders} />}

          {tab === "fees" && money && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-card p-4 shadow-soft">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-muted-foreground">{t.payments.balance}</p>
                  <p className={cn("tabular text-2xl font-extrabold", money.balance > 0 && "text-accent-700 dark:text-accent-300")}>
                    {money.balance > 0 ? fmt(money.balance) : t.payments.balanceClear}
                  </p>
                </div>
                <Button variant="outline" onClick={() => setDialog("fee")}>
                  {t.payments.addFee}
                </Button>
                <Button onClick={() => setDialog("payment")}>{t.payments.takePayment}</Button>
              </div>
              <Card className="p-2">
                <MoneyList charges={money.charges} payments={money.payments} canVoid={can.void} onChange={refresh} />
              </Card>
            </div>
          )}
        </div>
      </div>

      {dialog === "edit" && <PatientDialog open onOpenChange={() => setDialog(null)} patient={patient} showAlerts={can.alerts} today={today} onSaved={() => refresh()} />}
      {dialog === "book" && (
        <BookDialog open onOpenChange={() => setDialog(null)} doctors={active} today={today} showAlerts={can.alerts} patient={patient} doctorId={myDoctorId} onSaved={() => refresh()} />
      )}
      {dialog === "queue" && (
        <WalkInDialog
          open
          onOpenChange={() => setDialog(null)}
          doctors={active}
          today={today}
          showAlerts={can.alerts}
          patient={patient}
          doctorId={myDoctorId}
          onSaved={(ticket) => toast.success(t.appointments.arrivedDone(ticket.number))}
        />
      )}
      {dialog === "fee" && <FeeDialog open onOpenChange={() => setDialog(null)} services={services} doctors={active} today={today} showAlerts={can.alerts} patient={patient} onSaved={refresh} />}
      {dialog === "payment" && money && <PaymentDialog open onOpenChange={() => setDialog(null)} patient={patient} balance={money.balance} onSaved={refresh} />}
      {dialog === "visit" && (
        <Dialog open onOpenChange={() => setDialog(null)}>
          <DialogContent closeLabel={t.common.close}>
            <DialogHeader>
              <DialogTitle>{p.newVisit}</DialogTitle>
            </DialogHeader>
            <Field label={t.doctors.pick}>{(id) => <DoctorSelect id={id} doctors={active} value={visitDoctor} onChange={setVisitDoctor} />}</Field>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialog(null)}>
                {t.common.cancel}
              </Button>
              <Button onClick={startVisit} disabled={busy || !visitDoctor}>
                {t.visits.open}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      <ConfirmDialog
        open={dialog === "delete"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={p.deleteTitle}
        description={p.deleteText}
        confirmLabel={t.common.delete}
        destructive
        onConfirm={async () => {
          await sendJson(`/api/patients/${patient.id}`, "DELETE");
          toast.success(p.deleted);
          router.push(shop.href("/dashboard/patients"));
        }}
      />
    </PageBody>
  );
}

// Fees and payments, newest first, in one list.
export function MoneyList({ charges, payments, canVoid, onChange, showPatient = false }: { charges: Charge[]; payments: Payment[]; canVoid: boolean; onChange: () => void; showPatient?: boolean }) {
  const { t, dateTime, money } = useI18n();
  const m = t.payments;
  const [cancel, setCancel] = useState<{ kind: "charge" | "payment"; id: number } | null>(null);
  const rows = [
    ...charges.map((c) => ({ kind: "charge" as const, id: c.id, at: c.at, label: c.description, who: c.patientName, amount: c.amount - c.discount, extra: c.discount ? `−${money(c.discount)}` : "", voided: c.voided, by: c.createdBy })),
    ...payments.map((p) => ({ kind: "payment" as const, id: p.id, at: p.at, label: m.methods[p.method], who: p.patientName, amount: p.amount, extra: "", voided: p.voided, by: p.createdBy })),
  ].sort((a, b) => b.at - a.at);
  if (rows.length === 0) return <p className="py-10 text-center text-sm text-muted-foreground">{m.none}</p>;
  return (
    <>
      <ul className="space-y-1">
        {rows.map((r) => (
          <li key={`${r.kind}${r.id}`} className={cn("flex items-center gap-3 rounded-2xl px-3 py-2.5", r.voided && "opacity-50")}>
            <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", r.kind === "payment" ? "bg-primary-soft text-primary-soft-foreground" : "bg-muted text-muted-foreground")}>
              <FileTextIcon className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className={cn("block truncate text-sm font-bold", r.voided && "line-through")}>
                {showPatient ? `${r.who} · ` : ""}
                {r.kind === "payment" ? `${m.received}: ${r.label}` : r.label}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {dateTime(r.at)}
                {r.by && ` · ${r.by === "owner" ? t.common.ownerName : r.by}`}
                {r.voided && ` · ${m.cancelled}`}
              </span>
            </span>
            <span className="text-end">
              <span className={cn("tabular block text-sm font-extrabold", r.kind === "payment" && "text-primary")}>
                {r.kind === "payment" ? "+" : ""}
                {money(r.amount)}
              </span>
              {r.extra && <span className="tabular block text-[11px] text-muted-foreground">{r.extra}</span>}
            </span>
            {canVoid && !r.voided && (
              <Button variant="ghost" size="icon-sm" aria-label={r.kind === "charge" ? m.cancelFee : m.cancelPayment} onClick={() => setCancel({ kind: r.kind, id: r.id })}>
                <Trash2Icon />
              </Button>
            )}
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={cancel !== null}
        onOpenChange={(o) => !o && setCancel(null)}
        title={cancel?.kind === "payment" ? m.cancelPayment : m.cancelFee}
        description={m.cancelText}
        confirmLabel={cancel?.kind === "payment" ? m.cancelPayment : m.cancelFee}
        destructive
        onConfirm={async () => {
          if (!cancel) return;
          await sendJson(`/api/${cancel.kind === "charge" ? "charges" : "payments"}/${cancel.id}`, "DELETE");
          setCancel(null);
          onChange();
        }}
      />
    </>
  );
}
