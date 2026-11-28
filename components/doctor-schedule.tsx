"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { minutesToTime, timeToMinutes, type Doctor, type DoctorSchedule } from "@/lib/clinic";
import { errorMessage, sendJson } from "@/lib/clientApi";
import { cn } from "@/lib/utils";
import { FormError } from "./form-error";
import { useI18n } from "./i18n-provider";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";

// Rows from Saturday, as the week runs in Iraq and Kurdistan.
const ORDER = [6, 0, 1, 2, 3, 4, 5];

type Row = { on: boolean; from: string; to: string };

// A doctor's working week and days off. Booking shows free times only in
// these hours, and warns (without refusing) when booking outside them.
export function ScheduleDialog({ doctor, clinicHours, today, onClose, onSaved }: { doctor: Doctor; clinicHours: { startMin: number; endMin: number }; today: string; onClose: () => void; onSaved: () => void }) {
  const { t, day: dayText } = useI18n();
  const d = t.doctors;
  const initialWeek = doctor.schedule.week;
  const [custom, setCustom] = useState(initialWeek !== null);
  const [rows, setRows] = useState<Row[]>(() =>
    Array.from({ length: 7 }, (_, w) => {
      const h = initialWeek?.[w];
      return {
        // Friday off by default when starting a custom week.
        on: initialWeek ? Boolean(h) : w !== 5,
        from: minutesToTime(h ? h[0] : clinicHours.startMin),
        to: minutesToTime(Math.min(h ? h[1] : clinicHours.endMin, 23 * 60 + 59)),
      };
    }),
  );
  const [off, setOff] = useState(doctor.schedule.off.filter((o) => o.to >= today));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setRow = (w: number, change: Partial<Row>) => setRows((list) => list.map((r, i) => (i === w ? { ...r, ...change } : r)));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    let week: DoctorSchedule["week"] = null;
    if (custom) {
      week = [];
      for (const r of rows) {
        if (!r.on) {
          week.push(null);
          continue;
        }
        const a = timeToMinutes(r.from);
        const b = timeToMinutes(r.to);
        if (a === null || b === null || b <= a) return setError(d.badHours);
        week.push([a, b]);
      }
    }
    if (off.some((o) => !o.from || !o.to || o.to < o.from)) return setError(d.badDays);
    setBusy(true);
    try {
      const { schedule: _old, ...rest } = doctor;
      void _old;
      await sendJson(`/api/doctors/${doctor.id}`, "PATCH", { ...rest, schedule: { week, off } });
      onSaved();
    } catch (err) {
      setError(errorMessage(err, t.common.somethingWrong));
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent closeLabel={t.common.close} className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{d.scheduleTitle(doctor.name)}</DialogTitle>
          <DialogDescription>{d.scheduleText}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5">
          <Label className="flex items-center justify-between gap-3 rounded-2xl bg-muted/50 px-4 py-3">
            <span>
              <span className="block">{d.ownWeek}</span>
              <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                {custom ? d.ownWeekOn : d.ownWeekOff(minutesToTime(clinicHours.startMin), minutesToTime(Math.min(clinicHours.endMin, 23 * 60 + 59)))}
              </span>
            </span>
            <Switch checked={custom} onCheckedChange={setCustom} />
          </Label>

          {custom && (
            <ul className="space-y-1.5">
              {ORDER.map((w) => {
                const r = rows[w];
                return (
                  <li key={w} className={cn("flex flex-wrap items-center gap-3 rounded-2xl px-3 py-2", r.on ? "bg-muted/40" : "opacity-70")}>
                    <Switch checked={r.on} onCheckedChange={(on) => setRow(w, { on })} aria-label={t.weekdays[w]} />
                    <span className="w-24 text-sm font-bold">{t.weekdays[w]}</span>
                    {r.on ? (
                      <span className="flex items-center gap-2" dir="ltr">
                        <Input type="time" value={r.from} onChange={(e) => setRow(w, { from: e.target.value })} className="h-9 w-28" aria-label={`${t.weekdays[w]} ${t.settings.hoursFrom}`} />
                        <span className="text-muted-foreground">–</span>
                        <Input type="time" value={r.to} onChange={(e) => setRow(w, { to: e.target.value })} className="h-9 w-28" aria-label={`${t.weekdays[w]} ${t.settings.hoursTo}`} />
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">{d.notWorking}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-extrabold">{d.daysOff}</p>
              <Button type="button" size="sm" variant="soft" onClick={() => setOff((l) => [...l, { from: today, to: today, note: "" }])} disabled={off.length >= 60}>
                <PlusIcon />
                {d.addDaysOff}
              </Button>
            </div>
            {off.length === 0 ? (
              <p className="text-sm text-muted-foreground">{d.noDaysOff}</p>
            ) : (
              <ul className="space-y-2">
                {off.map((o, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-2 rounded-2xl bg-muted/40 p-2">
                    <Input type="date" value={o.from} min={today} onChange={(e) => setOff((l) => l.map((x, j) => (j === i ? { ...x, from: e.target.value, to: x.to < e.target.value ? e.target.value : x.to } : x)))} className="h-9 w-auto" aria-label={t.reports.from} />
                    <span className="text-muted-foreground">–</span>
                    <Input type="date" value={o.to} min={o.from} onChange={(e) => setOff((l) => l.map((x, j) => (j === i ? { ...x, to: e.target.value } : x)))} className="h-9 w-auto" aria-label={t.reports.to} />
                    <Input value={o.note} onChange={(e) => setOff((l) => l.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)))} placeholder={d.daysOffNote} maxLength={80} className="h-9 min-w-32 flex-1" aria-label={d.daysOffNote} />
                    <Button type="button" variant="ghost" size="icon-sm" aria-label={t.common.delete} onClick={() => setOff((l) => l.filter((_, j) => j !== i))}>
                      <Trash2Icon />
                    </Button>
                    <span className="sr-only">{o.from === o.to ? dayText(o.from) : `${dayText(o.from)} – ${dayText(o.to)}`}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <FormError message={error} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t.common.cancel}
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? t.common.saving : t.common.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
