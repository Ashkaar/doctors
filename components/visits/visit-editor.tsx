"use client";

import { ArrowLeftIcon, BanknoteIcon, PlusIcon, PrinterIcon, SaveIcon, StarIcon, Trash2Icon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState } from "react";
import { toast } from "sonner";
import { ageOn, type Doctor, type Medicine, type Order, type Patient, type PatientFile, type RxItem, type Service, type Visit, type Vitals } from "@/lib/clinic";
import { errorMessage, sendJson } from "@/lib/clientApi";
import { toLatinDigits } from "@/lib/format";
import { DoctorSelect } from "../clinic/booking";
import { Field } from "../clinic/fields";
import { FeeDialog } from "../clinic/money";
import { useI18n } from "../i18n-provider";
import { FilesPanel } from "../patients/files-panel";
import { PageBody } from "../page-header";
import { useShop } from "../shop-provider";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";

// Vitals are typed as people say them ("37.5", "82.5 kg") and kept as whole
// numbers (tenths of a degree, grams, millimetres).
type VitalKey = "bp" | "pulse" | "temp" | "spo2" | "resp" | "weight" | "height" | "sugar";

const num = (s: string) => {
  const v = toLatinDigits(s).replace(",", ".").replace("٫", ".").trim();
  if (!v) return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};
const fixed = (n: number | undefined, div: number, places: number) => (n === undefined ? "" : String(Number((n / div).toFixed(places))));

function vitalsToText(v: Vitals): Record<VitalKey, string> {
  return {
    bp: v.bpSys !== undefined ? `${v.bpSys}/${v.bpDia ?? ""}` : "",
    pulse: v.pulse !== undefined ? String(v.pulse) : "",
    temp: fixed(v.tempC10, 10, 1),
    spo2: v.spo2 !== undefined ? String(v.spo2) : "",
    resp: v.resp !== undefined ? String(v.resp) : "",
    weight: fixed(v.weightG, 1000, 1),
    height: fixed(v.heightMm, 10, 1),
    sugar: v.sugar !== undefined ? String(v.sugar) : "",
  };
}

function textToVitals(t: Record<VitalKey, string>): Vitals {
  const out: Vitals = {};
  const [sys, dia] = toLatinDigits(t.bp).split(/[/\\-]/);
  const round = (n: number | undefined, mul: number, max: number) => (n === undefined ? undefined : Math.min(max, Math.round(n * mul)));
  out.bpSys = round(num(sys ?? ""), 1, 400);
  out.bpDia = round(num(dia ?? ""), 1, 300);
  out.pulse = round(num(t.pulse), 1, 400);
  out.tempC10 = round(num(t.temp), 10, 500);
  out.spo2 = round(num(t.spo2), 1, 100);
  out.resp = round(num(t.resp), 1, 200);
  out.weightG = round(num(t.weight), 1000, 500_000);
  out.heightMm = round(num(t.height), 10, 3000);
  out.sugar = round(num(t.sugar), 1, 3000);
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined)) as Vitals;
}

const blankItem = (): RxItem => ({ medicine: "", dose: "", frequency: "", duration: "", notes: "" });

export function VisitEditor({
  visit,
  patient,
  today,
  doctors,
  medicines,
  orders,
  files,
  services,
  can,
}: {
  visit: Visit;
  patient: Patient;
  today: string;
  doctors: Doctor[];
  medicines: Medicine[];
  orders: Order[];
  files: PatientFile[];
  services: Service[];
  can: { full: boolean; rx: boolean; files: boolean; fees: boolean; saveMedicines: boolean };
}) {
  const { t, dateTime, dir } = useI18n();
  const v = t.visits;
  const shop = useShop();
  const router = useRouter();
  const listId = useId();
  const [vitals, setVitals] = useState(() => vitalsToText(visit.vitals));
  const [notes, setNotes] = useState({
    complaint: visit.complaint,
    history: visit.history,
    examination: visit.examination,
    diagnosis: visit.diagnosis ?? "",
    plan: visit.plan,
    followUp: visit.followUp,
    rxNotes: visit.rxNotes,
  });
  const [items, setItems] = useState<RxItem[]>(visit.items);
  const [doctorId, setDoctorId] = useState(visit.doctorId);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fee, setFee] = useState(false);
  const [saved, setSaved] = useState(medicines.map((m) => m.name.toLowerCase()));
  const age = patient.birthDate ? ageOn(patient.birthDate, today) : null;
  const hasAlerts = Boolean(patient.allergies?.trim() || patient.conditions?.trim());
  const doctor = doctors.find((d) => d.id === doctorId);

  // Leaving with unsaved changes asks first.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const bmi = useMemo(() => {
    const w = num(vitals.weight);
    const h = num(vitals.height);
    return w && h ? (w / (h / 100) ** 2).toFixed(1) : null;
  }, [vitals.weight, vitals.height]);

  const change = <T,>(set: (fn: (prev: T) => T) => void) => (fn: (prev: T) => T) => {
    set(fn);
    setDirty(true);
  };
  const setV = change(setVitals);
  const setN = change(setNotes);
  const setI = change(setItems);

  const save = async () => {
    setBusy(true);
    try {
      await sendJson(`/api/visits/${visit.id}`, "PATCH", {
        vitals: textToVitals(vitals),
        ...(can.full ? { notes, doctorId } : {}),
        ...(can.rx ? { items: items.filter((i) => i.medicine.trim()) } : {}),
      });
      setDirty(false);
      toast.success(v.saved);
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err, t.common.somethingWrong));
    } finally {
      setBusy(false);
    }
  };

  const pickMedicine = (index: number, name: string) => {
    const m = medicines.find((x) => x.name.toLowerCase() === name.trim().toLowerCase());
    setI((list) =>
      list.map((it, i) =>
        i !== index ? it : { ...it, medicine: name, ...(m && !it.dose && !it.frequency && !it.duration ? { dose: m.dose, frequency: m.frequency, duration: m.duration } : {}) },
      ),
    );
  };

  const saveToList = async (item: RxItem) => {
    try {
      await sendJson("/api/medicines", "POST", { name: item.medicine.trim(), dose: item.dose, frequency: item.frequency, duration: item.duration });
      setSaved((s) => [...s, item.medicine.trim().toLowerCase()]);
      toast.success(t.common.saved);
    } catch (err) {
      toast.error(errorMessage(err, t.common.somethingWrong));
    }
  };

  const vital = (key: VitalKey, label: string, unit: string, mode: "decimal" | "numeric" | "text" = "decimal") => (
    <Field label={label} key={key}>
      {(id) => (
        <div className="relative">
          <Input id={id} value={vitals[key]} onChange={(e) => setV((p) => ({ ...p, [key]: e.target.value }))} inputMode={mode} dir="ltr" className="pe-14 text-end font-bold" autoComplete="off" />
          <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{unit}</span>
        </div>
      )}
    </Field>
  );

  const note = (key: keyof typeof notes, label: string, rows = 3, hint?: string) => (
    <Field label={label} key={key}>
      {(id) => <Textarea id={id} value={notes[key]} onChange={(e) => setN((p) => ({ ...p, [key]: e.target.value }))} rows={rows} placeholder={hint} maxLength={4000} />}
    </Field>
  );

  const Back = ArrowLeftIcon;

  return (
    <PageBody>
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="icon" aria-label={t.common.back}>
          <Link href={shop.href(`/dashboard/patients/${patient.id}`)}>
            <Back className="rtl:-scale-x-100" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-extrabold tracking-tight">{patient.name}</h1>
          <p className="text-sm text-muted-foreground">
            {t.patients.fileNo(patient.fileNo)}
            {patient.gender && ` · ${t.patients.genders[patient.gender]}`}
            {age !== null && ` · ${t.patients.age(age)}`}
            {patient.bloodGroup && ` · ${patient.bloodGroup}`} · {dateTime(visit.at)}
          </p>
        </div>
        {can.fees && (
          <Button variant="outline" onClick={() => setFee(true)}>
            <BanknoteIcon />
            {v.fee}
          </Button>
        )}
        {can.rx && (
          <Button asChild variant="outline" disabled={dirty}>
            <Link
              href={shop.href(`/dashboard/visits/${visit.id}/print`)}
              target="_blank"
              onClick={(e) => {
                if (dirty) {
                  e.preventDefault();
                  toast(v.rxSaveFirst);
                }
              }}
            >
              <PrinterIcon />
              {v.rxPrint}
            </Link>
          </Button>
        )}
      </div>

      {hasAlerts && (
        <div className="flex items-start gap-3 rounded-2xl bg-accent-100 p-4 text-sm font-semibold text-accent-950 dark:bg-accent-500/15 dark:text-accent-100">
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-accent-700 dark:text-accent-300" />
          <span className="min-w-0 whitespace-pre-line">{[patient.allergies, patient.conditions].filter((x) => x?.trim()).join(" · ")}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {can.full ? (
            <Card>
              <CardHeader className="items-center">
                <CardTitle>{v.title}</CardTitle>
                {doctors.length > 1 && (
                  <div className="w-56">
                    <DoctorSelect doctors={doctors.filter((d) => d.active || d.id === visit.doctorId)} value={doctorId} onChange={(id) => { setDoctorId(id); setDirty(true); }} />
                  </div>
                )}
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">{note("complaint", v.complaint, 2, v.complaintHint)}</div>
                {note("history", v.history)}
                {note("examination", v.examination)}
                <div className="sm:col-span-2">{note("diagnosis", v.diagnosis, 2)}</div>
                <div className="sm:col-span-2">{note("plan", v.plan)}</div>
                <Field label={v.followUp}>
                  {(id) => <Input id={id} value={notes.followUp} onChange={(e) => setN((p) => ({ ...p, followUp: e.target.value }))} placeholder={v.followUpHint} maxLength={200} />}
                </Field>
              </CardContent>
            </Card>
          ) : (
            <p className="rounded-2xl bg-muted/50 p-4 text-sm text-muted-foreground">{v.vitalsOnly}</p>
          )}

          {can.rx && (
            <Card>
              <CardHeader className="items-center">
                <CardTitle>{v.rx}</CardTitle>
                <Button size="sm" variant="soft" onClick={() => setI((l) => [...l, blankItem()])}>
                  <PlusIcon />
                  {v.rxAdd}
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                <datalist id={listId}>
                  {medicines.map((m) => (
                    <option key={m.id} value={m.name}>
                      {m.form}
                    </option>
                  ))}
                </datalist>
                {items.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">{v.rxEmpty}</p>}
                {items.map((item, i) => (
                  <div key={i} className="space-y-2 rounded-2xl bg-muted/40 p-3">
                    <div className="flex items-center gap-2">
                      <span className="tabular flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-extrabold text-primary-foreground">{i + 1}</span>
                      <Input value={item.medicine} onChange={(e) => pickMedicine(i, e.target.value)} list={listId} placeholder={v.rxMedicine} aria-label={v.rxMedicine} className="flex-1 font-bold" maxLength={120} autoComplete="off" />
                      {can.saveMedicines && item.medicine.trim() && !saved.includes(item.medicine.trim().toLowerCase()) && (
                        <Button variant="ghost" size="icon-sm" aria-label={t.medicines.saveToList} title={t.medicines.saveToList} onClick={() => saveToList(item)}>
                          <StarIcon />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon-sm" aria-label={t.common.delete} onClick={() => setI((l) => l.filter((_, j) => j !== i))}>
                        <Trash2Icon />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {(["dose", "frequency", "duration", "notes"] as const).map((k) => (
                        <Input
                          key={k}
                          value={item[k]}
                          onChange={(e) => setI((l) => l.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)))}
                          placeholder={k === "dose" ? v.rxDose : k === "frequency" ? v.rxFrequency : k === "duration" ? v.rxDuration : v.rxNotes}
                          aria-label={k === "dose" ? v.rxDose : k === "frequency" ? v.rxFrequency : k === "duration" ? v.rxDuration : v.rxNotes}
                          maxLength={k === "notes" ? 200 : 60}
                          dir={dir}
                        />
                      ))}
                    </div>
                  </div>
                ))}
                {note("rxNotes", v.rxNotesLabel, 2)}
              </CardContent>
            </Card>
          )}

          {can.files && <FilesPanel patientId={patient.id} visitId={visit.id} files={files} orders={orders} />}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{v.vitals}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <div className="col-span-2">{vital("bp", v.bp, v.bpUnit, "text")}</div>
              {vital("pulse", v.pulse, v.pulseUnit, "numeric")}
              {vital("temp", v.temp, v.tempUnit)}
              {vital("spo2", v.spo2, v.spo2Unit, "numeric")}
              {vital("resp", v.resp, v.respUnit, "numeric")}
              {vital("weight", v.weight, v.weightUnit)}
              {vital("height", v.height, v.heightUnit)}
              {vital("sugar", v.sugar, v.sugarUnit, "numeric")}
              {bmi && (
                <div className="flex flex-col justify-end">
                  <p className="text-xs font-semibold text-muted-foreground">{v.bmi}</p>
                  <p className="tabular text-xl font-extrabold">{bmi}</p>
                </div>
              )}
            </CardContent>
          </Card>
          {doctor && <p className="px-2 text-xs text-muted-foreground">{v.withDoctor(doctor.name)}</p>}
        </div>
      </div>

      <div className="no-print sticky bottom-24 z-20 flex justify-end md:bottom-4">
        <Button size="lg" onClick={save} disabled={busy} className="shadow-[var(--shadow-float)]">
          <SaveIcon />
          {busy ? t.common.saving : v.saveVisit}
        </Button>
      </div>

      {fee && (
        <FeeDialog
          open
          onOpenChange={setFee}
          services={services}
          doctors={doctors.filter((d) => d.active)}
          today={today}
          showAlerts
          patient={patient}
          visitId={visit.id}
          doctorId={doctorId}
          onSaved={() => toast.success(v.feeAdded)}
        />
      )}
    </PageBody>
  );
}
