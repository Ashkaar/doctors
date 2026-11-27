"use client";

import { BabyIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { errorMessage, sendJson } from "@/lib/clientApi";
import { toLatinDigits } from "@/lib/format";
import { eddFromLmp, gestation, type AncCheck, type Pregnancy } from "@/lib/specialties";
import { cn } from "@/lib/utils";
import { Chips, Field } from "../clinic/fields";
import { FormError } from "../form-error";
import { useI18n } from "../i18n-provider";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";

export type PregnancyWithChecks = Pregnancy & { checks: AncCheck[] };

const num = (s: string) => {
  const v = toLatinDigits(s).replace(",", ".").trim();
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};

function GaText({ edd, on }: { edd: string; on: string }) {
  const { t } = useI18n();
  const ga = gestation(edd, on);
  return ga ? <>{t.pregnancy.ga(ga.weeks, ga.days)}</> : <>—</>;
}

// The patient's pregnancies: the current one with its checks, and past ones.
export function PregnancyPanel({
  patientId,
  pregnancies,
  today,
  visitId = null,
  visitVitals,
}: {
  patientId: number;
  pregnancies: PregnancyWithChecks[];
  today: string;
  visitId?: number | null;
  // A visit's weight and blood pressure, to start the check from.
  visitVitals?: { weightG?: number; bpSys?: number; bpDia?: number };
}) {
  const { t, day: dayText } = useI18n();
  const pr = t.pregnancy;
  const router = useRouter();
  const [editing, setEditing] = useState<Pregnancy | "new" | null>(null);
  const current = pregnancies.find((p) => p.status === "active") ?? null;
  const past = pregnancies.filter((p) => p !== current);

  return (
    <div className="space-y-4">
      {current ? (
        <Card>
          <CardHeader className="items-center">
            <CardTitle className="flex items-center gap-2">
              <BabyIcon className="size-5 text-primary" />
              {pr.current}
            </CardTitle>
            <Button variant="ghost" size="icon-sm" aria-label={t.common.edit} onClick={() => setEditing(current)}>
              <PencilIcon />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="rounded-2xl bg-primary p-4 text-primary-foreground">
                <p className="text-2xl font-extrabold">
                  <GaText edd={current.edd} on={today} />
                </p>
                <p className="text-xs font-semibold opacity-85">{pr.weeksNow}</p>
              </div>
              <div className="rounded-2xl bg-muted/50 p-4">
                <p className="text-lg font-extrabold">{dayText(current.edd)}</p>
                <p className="text-xs font-semibold text-muted-foreground">{pr.edd}</p>
              </div>
              <div className="rounded-2xl bg-muted/50 p-4">
                <p className="text-lg font-extrabold">{dayText(current.lmp)}</p>
                <p className="text-xs font-semibold text-muted-foreground">{pr.lmp}</p>
              </div>
              <div className="rounded-2xl bg-muted/50 p-4">
                <p className="tabular text-lg font-extrabold" dir="ltr">
                  G{current.gravida ?? "–"} P{current.para ?? "–"}
                </p>
                <p className="text-xs font-semibold text-muted-foreground">{pr.gp}</p>
              </div>
            </div>
            {current.notes && <p className="whitespace-pre-line rounded-2xl bg-muted/40 p-3 text-sm">{current.notes}</p>}
            <Checks pregnancy={current} today={today} visitId={visitId} visitVitals={visitVitals} onChanged={() => router.refresh()} />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <BabyIcon className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{pr.none}</p>
            <Button onClick={() => setEditing("new")}>
              <PlusIcon />
              {pr.start}
            </Button>
          </CardContent>
        </Card>
      )}

      {past.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{pr.past}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5">
              {past.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-muted/40 px-3 py-2.5 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold">{pr.eddShort(dayText(p.edd))}</span>
                    <span className="block text-xs text-muted-foreground">{[p.endedOn ? dayText(p.endedOn) : "", p.outcome].filter(Boolean).join(" · ") || "—"}</span>
                  </span>
                  <Badge variant="neutral">{pr.statuses[p.status]}</Badge>
                  <Button variant="ghost" size="icon-sm" aria-label={t.common.edit} onClick={() => setEditing(p)}>
                    <PencilIcon />
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {editing && (
        <PregnancyDialog
          patientId={patientId}
          pregnancy={editing === "new" ? null : editing}
          today={today}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function Checks({ pregnancy, today, visitId, visitVitals, onChanged }: { pregnancy: PregnancyWithChecks; today: string; visitId: number | null; visitVitals?: { weightG?: number; bpSys?: number; bpDia?: number }; onChanged: () => void }) {
  const { t, day: dayText } = useI18n();
  const pr = t.pregnancy;
  const [form, setForm] = useState({
    day: today,
    weight: visitVitals?.weightG ? String(visitVitals.weightG / 1000) : "",
    bp: visitVitals?.bpSys ? `${visitVitals.bpSys}/${visitVitals.bpDia ?? ""}` : "",
    fhr: "",
    fundal: "",
    presentation: "",
    notes: "",
  });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const weight = num(form.weight);
    const [sys, dia] = toLatinDigits(form.bp).split("/");
    const bpSys = num(sys ?? "");
    const bpDia = num(dia ?? "");
    const fhr = num(form.fhr);
    const fundal = num(form.fundal);
    if ([weight, bpSys, bpDia, fhr, fundal].includes(undefined)) return toast.error(t.errors.invalid);
    setBusy(true);
    try {
      await sendJson(`/api/pregnancies/${pregnancy.id}/checks`, "POST", {
        day: form.day,
        visitId,
        weightG: weight == null ? null : Math.round(weight * 1000),
        bpSys: bpSys == null ? null : Math.round(bpSys),
        bpDia: bpDia == null ? null : Math.round(bpDia),
        fhr: fhr == null ? null : Math.round(fhr),
        fundalCm: fundal == null ? null : Math.round(fundal),
        presentation: form.presentation,
        notes: form.notes,
      });
      setForm((f) => ({ ...f, fhr: "", fundal: "", presentation: "", notes: "" }));
      onChanged();
    } catch (err) {
      toast.error(errorMessage(err, t.common.somethingWrong));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: number) => {
    try {
      await sendJson(`/api/anc-checks/${id}`, "DELETE");
      onChanged();
    } catch (err) {
      toast.error(errorMessage(err, t.common.somethingWrong));
    }
  };

  const cell = "px-2 py-2 text-start";
  return (
    <div className="space-y-3">
      <p className="text-sm font-extrabold">{pr.checks}</p>
      {pregnancy.checks.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground">
                <th className={cell}>{t.common.date}</th>
                <th className={cell}>{pr.weeks}</th>
                <th className={cell}>{t.visits.weight}</th>
                <th className={cell}>{t.visits.bp}</th>
                <th className={cell}>{pr.fhr}</th>
                <th className={cell}>{pr.fundal}</th>
                <th className={cell}>{pr.presentation}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pregnancy.checks.map((c) => (
                <tr key={c.id} className="border-t border-border align-top">
                  <td className={cn(cell, "font-bold")}>{dayText(c.day)}</td>
                  <td className={cell}>
                    <GaText edd={pregnancy.edd} on={c.day} />
                  </td>
                  <td className={cn(cell, "tabular")}>{c.weightG ? `${(c.weightG / 1000).toFixed(1)} kg` : "—"}</td>
                  <td className={cn(cell, "tabular")} dir="ltr">
                    {c.bpSys ? `${c.bpSys}/${c.bpDia ?? "–"}` : "—"}
                  </td>
                  <td className={cn(cell, "tabular")}>{c.fhr ?? "—"}</td>
                  <td className={cn(cell, "tabular")}>{c.fundalCm ? `${c.fundalCm} cm` : "—"}</td>
                  <td className={cell}>
                    {c.presentation || "—"}
                    {c.notes && <span className="block text-xs text-muted-foreground">{c.notes}</span>}
                  </td>
                  <td className="py-1">
                    <Button variant="ghost" size="icon-sm" aria-label={t.common.delete} onClick={() => remove(c.id)}>
                      <Trash2Icon />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <form onSubmit={add} className="grid grid-cols-2 gap-2 rounded-2xl bg-muted/40 p-3 sm:grid-cols-4">
        <Field label={t.common.date}>{(id) => <Input id={id} type="date" value={form.day} max={today} onChange={(e) => set("day", e.target.value)} />}</Field>
        <Field label={`${t.visits.weight} (kg)`}>{(id) => <Input id={id} value={form.weight} onChange={(e) => set("weight", e.target.value)} inputMode="decimal" dir="ltr" />}</Field>
        <Field label={`${t.visits.bp} (mmHg)`}>{(id) => <Input id={id} value={form.bp} onChange={(e) => set("bp", e.target.value)} placeholder="120/80" dir="ltr" />}</Field>
        <Field label={`${pr.fhr} (/min)`}>{(id) => <Input id={id} value={form.fhr} onChange={(e) => set("fhr", e.target.value)} inputMode="numeric" dir="ltr" />}</Field>
        <Field label={`${pr.fundal} (cm)`}>{(id) => <Input id={id} value={form.fundal} onChange={(e) => set("fundal", e.target.value)} inputMode="numeric" dir="ltr" />}</Field>
        <Field label={pr.presentation}>{(id) => <Input id={id} value={form.presentation} onChange={(e) => set("presentation", e.target.value)} placeholder={pr.presentationHint} maxLength={40} />}</Field>
        <Field label={t.common.notes} className="col-span-2">
          {(id) => <Input id={id} value={form.notes} onChange={(e) => set("notes", e.target.value)} maxLength={1000} />}
        </Field>
        <Button type="submit" variant="soft" disabled={busy} className="col-span-2 sm:col-span-4 sm:justify-self-start">
          <PlusIcon />
          {pr.addCheck}
        </Button>
      </form>
    </div>
  );
}

function PregnancyDialog({ patientId, pregnancy, today, onClose, onSaved }: { patientId: number; pregnancy: Pregnancy | null; today: string; onClose: () => void; onSaved: () => void }) {
  const { t, day: dayText } = useI18n();
  const pr = t.pregnancy;
  const [lmp, setLmp] = useState(pregnancy?.lmp ?? "");
  const [edd, setEdd] = useState(pregnancy && pregnancy.edd !== eddFromLmp(pregnancy.lmp) ? pregnancy.edd : "");
  const [gravida, setGravida] = useState(pregnancy?.gravida == null ? "" : String(pregnancy.gravida));
  const [para, setPara] = useState(pregnancy?.para == null ? "" : String(pregnancy.para));
  const [status, setStatus] = useState<Pregnancy["status"]>(pregnancy?.status ?? "active");
  const [endedOn, setEndedOn] = useState(pregnancy?.endedOn ?? "");
  const [outcome, setOutcome] = useState(pregnancy?.outcome ?? "");
  const [notes, setNotes] = useState(pregnancy?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoEdd = /^\d{4}-\d{2}-\d{2}$/.test(lmp) ? eddFromLmp(lmp) : "";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const g = num(gravida);
    const p = num(para);
    if (!lmp || g === undefined || p === undefined) return setError(t.errors.invalid);
    setBusy(true);
    setError(null);
    try {
      const body = { lmp, edd, gravida: g == null ? null : Math.round(g), para: p == null ? null : Math.round(p), status, endedOn: status === "active" ? "" : endedOn || today, outcome, notes };
      if (pregnancy) await sendJson(`/api/pregnancies/${pregnancy.id}`, "PATCH", body);
      else await sendJson(`/api/patients/${patientId}/pregnancies`, "POST", body);
      onSaved();
    } catch (err) {
      setError(errorMessage(err, t.common.somethingWrong));
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent closeLabel={t.common.close}>
        <DialogHeader>
          <DialogTitle>{pregnancy ? pr.editTitle : pr.start}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid grid-cols-2 gap-3">
          <Field label={pr.lmp}>{(id) => <Input id={id} type="date" value={lmp} max={today} onChange={(e) => setLmp(e.target.value)} required />}</Field>
          <Field label={pr.eddOverride} hint={autoEdd ? pr.eddAuto(dayText(autoEdd)) : undefined}>
            {(id) => <Input id={id} type="date" value={edd} onChange={(e) => setEdd(e.target.value)} />}
          </Field>
          <Field label={pr.gravida}>{(id) => <Input id={id} value={gravida} onChange={(e) => setGravida(e.target.value)} inputMode="numeric" dir="ltr" />}</Field>
          <Field label={pr.para}>{(id) => <Input id={id} value={para} onChange={(e) => setPara(e.target.value)} inputMode="numeric" dir="ltr" />}</Field>
          {pregnancy && (
            <div className="col-span-2 space-y-2">
              <p className="text-sm font-semibold">{pr.status}</p>
              <Chips label={pr.status} value={status} onChange={setStatus} options={(["active", "delivered", "ended"] as const).map((s) => ({ value: s, label: pr.statuses[s] }))} />
            </div>
          )}
          {status !== "active" && (
            <>
              <Field label={pr.endedOn}>{(id) => <Input id={id} type="date" value={endedOn || today} max={today} onChange={(e) => setEndedOn(e.target.value)} />}</Field>
              <Field label={pr.outcome}>{(id) => <Input id={id} value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder={pr.outcomeHint} maxLength={200} />}</Field>
            </>
          )}
          <Field label={t.common.notes} className="col-span-2">
            {(id) => <Textarea id={id} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} className="min-h-16" />}
          </Field>
          <div className="col-span-2">
            <FormError message={error} />
          </div>
          <DialogFooter className="col-span-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {t.common.cancel}
            </Button>
            <Button type="submit" disabled={busy || !lmp}>
              {busy ? t.common.saving : t.common.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
