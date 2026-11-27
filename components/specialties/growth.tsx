"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState } from "react";
import { toast } from "sonner";
import { errorMessage, sendJson } from "@/lib/clientApi";
import { addDays } from "@/lib/format";
import {
  ageInMonths,
  GROWTH_MAX_MONTHS,
  PERCENTILES,
  percentileOf,
  percentileValue,
  VACCINE_SCHEDULE,
  zScore,
  type GrowthMeasure,
  type Vaccination,
} from "@/lib/specialties";
import { cn } from "@/lib/utils";
import { Chips } from "../clinic/fields";
import { ConfirmDialog } from "../confirm-dialog";
import { useI18n } from "../i18n-provider";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";

export type GrowthPoint = { day: string; weightG?: number; heightMm?: number; headMm?: number };

const valueOf = (p: GrowthPoint, m: GrowthMeasure): number | null =>
  m === "weight" ? (p.weightG ? p.weightG / 1000 : null) : m === "height" ? (p.heightMm ? p.heightMm / 10 : null) : p.headMm ? p.headMm / 10 : null;

const W = 640;
const H = 340;
const PAD = { l: 44, r: 40, t: 14, b: 34 };

// Weight, length/height and head size on the WHO growth curves (0–5 years).
export function GrowthChart({ birthDate, sex, points, today }: { birthDate: string; sex: "m" | "f" | ""; points: GrowthPoint[]; today: string }) {
  const { t, day: dayText } = useI18n();
  const g = t.growth;
  const [measure, setMeasure] = useState<GrowthMeasure>("weight");
  const fullBirth = /^\d{4}-\d{2}-\d{2}$/.test(birthDate);
  const ageNow = fullBirth ? ageInMonths(birthDate, today) : null;

  const data = useMemo(() => {
    if (!fullBirth || (sex !== "m" && sex !== "f") || ageNow === null) return null;
    const maxX = ageNow <= 24 ? 24 : GROWTH_MAX_MONTHS;
    const measured = points
      .map((p) => ({ day: p.day, age: ageInMonths(birthDate, p.day), v: valueOf(p, measure) }))
      .filter((p): p is { day: string; age: number; v: number } => p.age !== null && p.v !== null && p.age <= GROWTH_MAX_MONTHS);
    const curves = PERCENTILES.map(({ p, z }) => {
      const pts: [number, number][] = [];
      for (let m = 0; m <= maxX; m += maxX <= 24 ? 0.5 : 1) {
        const v = percentileValue(measure, sex, m, z);
        if (v !== null) pts.push([m, v]);
      }
      return { p, pts };
    });
    const ys = [...curves.flatMap((c) => c.pts.map(([, v]) => v)), ...measured.map((p) => p.v)];
    let minY = Math.min(...ys);
    let maxY = Math.max(...ys);
    const pad = (maxY - minY) * 0.05;
    minY = Math.max(0, Math.floor(minY - pad));
    maxY = Math.ceil(maxY + pad);
    return { maxX, measured, curves, minY, maxY };
  }, [fullBirth, sex, ageNow, points, birthDate, measure]);

  const unit = measure === "weight" ? "kg" : "cm";
  const title = measure === "weight" ? g.weight : measure === "height" ? (ageNow !== null && ageNow < 24 ? g.length : g.height) : g.head;

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{g.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="rounded-2xl bg-muted/50 p-4 text-sm text-muted-foreground">{!fullBirth || ageNow === null ? g.needBirth : g.needSex}</p>
        </CardContent>
      </Card>
    );
  }

  const x = (m: number) => PAD.l + (m / data.maxX) * (W - PAD.l - PAD.r);
  const y = (v: number) => H - PAD.b - ((v - data.minY) / (data.maxY - data.minY)) * (H - PAD.t - PAD.b);
  const path = (pts: [number, number][]) => pts.map(([m, v], i) => `${i ? "L" : "M"}${x(m).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const p3 = data.curves[0].pts;
  const p97 = data.curves[data.curves.length - 1].pts;
  const band = `${path(p3)} ${[...p97].reverse().map(([m, v]) => `L${x(m).toFixed(1)} ${y(v).toFixed(1)}`).join(" ")} Z`;
  const xStep = data.maxX <= 24 ? 3 : 6;
  const yStep = Math.max(1, Math.round((data.maxY - data.minY) / 6));
  const latest = data.measured[data.measured.length - 1];
  const latestZ = latest ? zScore(measure, sex as "m" | "f", latest.age, latest.v) : null;

  return (
    <Card>
      <CardHeader className="items-center">
        <div>
          <CardTitle>{g.title}</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">{g.source}</p>
        </div>
        <Chips
          label={g.title}
          value={measure}
          onChange={setMeasure}
          options={[
            { value: "weight", label: g.weight },
            { value: "height", label: ageNow !== null && ageNow < 24 ? g.length : g.height },
            { value: "head", label: g.head },
          ]}
        />
      </CardHeader>
      <CardContent className="space-y-3">
        {latest && latestZ !== null && (
          <p className="text-sm">
            <span className="font-extrabold">
              {title}: {latest.v.toFixed(1)} {unit}
            </span>
            <span className="text-muted-foreground"> · {g.percentile(Math.round(percentileOf(latestZ)))} · {dayText(latest.day)}</span>
          </p>
        )}
        <div dir="ltr">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${title} (${unit}) · ${g.title}`}>
          <path d={band} className="fill-primary-soft" />
          {Array.from({ length: Math.floor((data.maxY - data.minY) / yStep) + 1 }, (_, i) => data.minY + i * yStep).map((v) => (
            <g key={v}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} className="stroke-border" strokeWidth="1" />
              <text x={PAD.l - 6} y={y(v) + 4} textAnchor="end" className="fill-muted-foreground text-[11px]">
                {v}
              </text>
            </g>
          ))}
          {Array.from({ length: Math.floor(data.maxX / xStep) + 1 }, (_, i) => i * xStep).map((m) => (
            <text key={m} x={x(m)} y={H - PAD.b + 16} textAnchor="middle" className="fill-muted-foreground text-[11px]">
              {m}
            </text>
          ))}
          <text x={(PAD.l + W - PAD.r) / 2} y={H - 4} textAnchor="middle" className="fill-muted-foreground text-[11px] font-bold">
            {g.ageMonths}
          </text>
          <text x={10} y={PAD.t + 4} className="fill-muted-foreground text-[11px] font-bold">
            {unit}
          </text>
          {data.curves.map((c) => (
            <g key={c.p}>
              <path d={path(c.pts)} className={cn("fill-none", c.p === 50 ? "stroke-primary" : "stroke-brand-300")} strokeWidth={c.p === 50 ? 2.5 : 1.25} strokeDasharray={c.p === 50 ? undefined : "4 3"} />
              <text x={W - PAD.r + 4} y={y(c.pts[c.pts.length - 1][1]) + 4} className="fill-muted-foreground text-[10px] font-bold">
                {c.p}
              </text>
            </g>
          ))}
          {data.measured.length > 1 && <path d={path(data.measured.map((p) => [p.age, p.v]))} className="fill-none stroke-accent-700" strokeWidth="2" />}
          {data.measured.map((p) => (
            <circle key={p.day} cx={x(p.age)} cy={y(p.v)} r="4.5" className="fill-accent-500 stroke-card" strokeWidth="2">
              <title>{`${dayText(p.day)}: ${p.v.toFixed(1)} ${unit}`}</title>
            </circle>
          ))}
        </svg>
        </div>
        {data.measured.length === 0 && <p className="text-center text-sm text-muted-foreground">{g.noPoints}</p>}
        {ageNow !== null && ageNow > GROWTH_MAX_MONTHS && <p className="text-xs text-muted-foreground">{g.overFive}</p>}
      </CardContent>
    </Card>
  );
}

// Vaccines given, against a common schedule by age.
export function Vaccinations({ patientId, birthDate, today, given }: { patientId: number; birthDate: string; today: string; given: Vaccination[] }) {
  const { t, day: dayText } = useI18n();
  const v = t.vaccines;
  const router = useRouter();
  const listId = useId();
  const [vaccine, setVaccine] = useState("");
  const [givenOn, setGivenOn] = useState(today);
  const [batch, setBatch] = useState("");
  const [busy, setBusy] = useState(false);
  const [remove, setRemove] = useState<number | null>(null);
  const fullBirth = /^\d{4}-\d{2}-\d{2}$/.test(birthDate);
  const age = fullBirth ? ageInMonths(birthDate, today) : null;

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vaccine.trim()) return;
    setBusy(true);
    try {
      await sendJson(`/api/patients/${patientId}/vaccinations`, "POST", { vaccine, givenOn, batch });
      setVaccine("");
      setBatch("");
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err, t.common.somethingWrong));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{v.title}</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">{v.scheduleNote}</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={add} className="grid grid-cols-1 gap-2 rounded-2xl bg-muted/40 p-2 sm:grid-cols-[1fr_10rem_8rem_auto]">
          <Input value={vaccine} onChange={(e) => setVaccine(e.target.value)} list={listId} placeholder={v.vaccine} aria-label={v.vaccine} maxLength={80} />
          <datalist id={listId}>
            {VACCINE_SCHEDULE.map((s) => (
              <option key={s.id} value={s.name} />
            ))}
          </datalist>
          <Input type="date" value={givenOn} max={today} onChange={(e) => setGivenOn(e.target.value)} aria-label={v.givenOn} />
          <Input value={batch} onChange={(e) => setBatch(e.target.value)} placeholder={v.batch} aria-label={v.batch} maxLength={40} dir="ltr" />
          <Button type="submit" variant="soft" disabled={busy || !vaccine.trim()}>
            <PlusIcon />
            {v.record}
          </Button>
        </form>
        <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {VACCINE_SCHEDULE.map((s) => {
            const done = given.find((g) => g.vaccine.toLowerCase() === s.name.toLowerCase());
            const dueOn = fullBirth ? addDays(birthDate, Math.round(s.months * 30.4375)) : null;
            const overdue = !done && age !== null && age >= s.months + 1;
            const due = !done && age !== null && !overdue && age >= s.months - 0.25;
            return (
              <li key={s.id} className={cn("flex items-center gap-2 rounded-2xl px-3 py-2 text-sm", done ? "bg-primary-soft" : overdue ? "bg-accent-100 dark:bg-accent-500/15" : "bg-muted/40")}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{s.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {s.months === 0 ? v.atBirth : v.atMonths(s.months)}
                    {done ? ` · ${v.givenDay(dayText(done.givenOn))}` : dueOn ? ` · ${dayText(dueOn)}` : ""}
                  </span>
                </span>
                {done ? <Badge>{v.given}</Badge> : overdue ? <Badge variant="accent">{v.overdue}</Badge> : due ? <Badge variant="accent">{v.due}</Badge> : null}
                {!done && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setVaccine(s.name);
                      setGivenOn(today);
                    }}
                  >
                    {v.pick}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
        {given.filter((g) => !VACCINE_SCHEDULE.some((s) => s.name.toLowerCase() === g.vaccine.toLowerCase())).length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-bold text-muted-foreground">{v.other}</p>
            {given
              .filter((g) => !VACCINE_SCHEDULE.some((s) => s.name.toLowerCase() === g.vaccine.toLowerCase()))
              .map((g) => (
                <div key={g.id} className="flex items-center gap-2 rounded-2xl bg-primary-soft px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1 font-bold">{g.vaccine}</span>
                  <span className="text-xs text-muted-foreground">{dayText(g.givenOn)}</span>
                </div>
              ))}
          </div>
        )}
        {given.length > 0 && (
          <details>
            <summary className="cursor-pointer text-xs font-bold text-muted-foreground">{v.allGiven(given.length)}</summary>
            <ul className="mt-2 space-y-1">
              {given.map((g) => (
                <li key={g.id} className="flex items-center gap-2 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="font-bold">{g.vaccine}</span>
                    <span className="text-xs text-muted-foreground">
                      {" "}
                      · {dayText(g.givenOn)}
                      {g.batch && ` · ${v.batch} ${g.batch}`}
                      {g.createdBy && ` · ${g.createdBy === "owner" ? t.common.ownerName : g.createdBy}`}
                    </span>
                  </span>
                  <Button variant="ghost" size="icon-sm" aria-label={t.common.delete} onClick={() => setRemove(g.id)}>
                    <Trash2Icon />
                  </Button>
                </li>
              ))}
            </ul>
          </details>
        )}
      </CardContent>
      <ConfirmDialog
        open={remove !== null}
        onOpenChange={(o) => !o && setRemove(null)}
        title={v.deleteTitle}
        confirmLabel={t.common.delete}
        destructive
        onConfirm={async () => {
          await sendJson(`/api/vaccinations/${remove}`, "DELETE");
          setRemove(null);
          router.refresh();
        }}
      />
    </Card>
  );
}
