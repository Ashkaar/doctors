"use client";

import { CheckIcon, PlusIcon, RotateCcwIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { errorMessage, sendJson } from "@/lib/clientApi";
import {
  ADULT_LOWER,
  ADULT_UPPER,
  CHILD_LOWER,
  CHILD_UPPER,
  DENTAL_PROCEDURES,
  isBackTooth,
  SURFACES,
  TOOTH_CONDITIONS,
  type DentalProcedure,
  type DentalWork,
  type Surface,
  type ToothCondition,
  type ToothState,
} from "@/lib/specialties";
import { cn } from "@/lib/utils";
import { Chips, Field, NativeSelect } from "../clinic/fields";
import { useI18n } from "../i18n-provider";
import { MoneyInput } from "../money-input";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";

type Dentition = "adult" | "child" | "mixed";

// Conditions that sit on single surfaces; the rest cover the whole tooth.
const SURFACE_CONDITIONS: ToothCondition[] = ["caries", "filling"];

// Fill classes for the surface map (tokens only).
const SURFACE_FILL: Partial<Record<ToothCondition, string>> = {
  caries: "fill-accent-500",
  filling: "fill-brand-500",
};

// Which side of the drawn tooth is mesial (towards the middle of the mouth).
// Quadrants 1 and 4 (patient's right) are on the viewer's left, so their
// mesial side is on the right of each drawing; 2 and 3 the other way.
function sideOf(
  tooth: number,
  surface: Surface,
): "top" | "bottom" | "left" | "right" | "center" {
  if (surface === "o") return "center";
  const quadrant = Math.floor(tooth / 10) % 4 || 4; // 1..4 (5..8 map to 1..4)
  const upper = quadrant === 1 || quadrant === 2;
  if (surface === "b") return upper ? "top" : "bottom";
  if (surface === "l") return upper ? "bottom" : "top";
  const mesialRight = quadrant === 1 || quadrant === 4;
  if (surface === "m") return mesialRight ? "right" : "left";
  return mesialRight ? "left" : "right";
}

// The five regions of a 40×40 tooth drawing.
const REGION: Record<"top" | "bottom" | "left" | "right" | "center", string> = {
  top: "M2 2 L38 2 L27 13 L13 13 Z",
  bottom: "M2 38 L38 38 L27 27 L13 27 Z",
  left: "M2 2 L13 13 L13 27 L2 38 Z",
  right: "M38 2 L27 13 L27 27 L38 38 Z",
  center: "M13 13 L27 13 L27 27 L13 27 Z",
};

function ToothDrawing({
  tooth,
  state,
  planned,
  selected,
  onClick,
}: {
  tooth: number;
  state?: ToothState;
  planned: number;
  selected: boolean;
  onClick: () => void;
}) {
  const { t } = useI18n();
  const has = (c: ToothCondition) => state?.conditions.includes(c) ?? false;
  const surfaceClass = (surface: Surface) => {
    for (const c of SURFACE_CONDITIONS)
      if (state?.surfaces[c]?.includes(surface)) return SURFACE_FILL[c];
    // A condition marked on the tooth with no surfaces chosen colours it all.
    for (const c of SURFACE_CONDITIONS)
      if (has(c) && !state?.surfaces[c]?.length) return SURFACE_FILL[c];
    return "fill-card";
  };
  const missing = has("missing");
  const label = [
    t.dental.toothShort(tooth),
    ...(state?.conditions.map((c) => t.dental.conditions[c]) ?? []),
    planned ? t.dental.plannedCount(planned) : "",
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      aria-label={label}
      title={label}
      className={cn(
        "group relative flex w-full min-w-0 cursor-pointer flex-col items-center gap-0.5 rounded-xl p-0.5 transition-colors",
        selected ? "bg-primary-soft ring-2 ring-primary" : "hover:bg-muted/70",
      )}
    >
      <span className="tabular text-[10px] font-bold text-muted-foreground sm:text-[11px]">
        {tooth}
      </span>
      <svg
        viewBox="0 0 40 40"
        className={cn("aspect-square w-full max-w-10", missing && "opacity-35")}
        aria-hidden="true"
      >
        {(Object.keys(REGION) as (keyof typeof REGION)[]).map((side) => {
          const surface = SURFACES.find((s) => sideOf(tooth, s) === side)!;
          if (side === "center" && !isBackTooth(tooth)) {
            // Front teeth: a thin edge instead of a chewing surface.
            return (
              <path
                key={side}
                d="M13 18 L27 18 L27 22 L13 22 Z"
                className={cn("stroke-input", surfaceClass(surface))}
                strokeWidth="1"
              />
            );
          }
          return (
            <path
              key={side}
              d={REGION[side]}
              className={cn("stroke-input", surfaceClass(surface))}
              strokeWidth="1"
            />
          );
        })}
        {has("crown") && (
          <rect
            x="1.5"
            y="1.5"
            width="37"
            height="37"
            rx="6"
            className="fill-none stroke-accent-600"
            strokeWidth="3"
          />
        )}
        {has("rootCanal") && (
          <path
            d="M20 4 L20 36"
            className="stroke-brand-900 dark:stroke-brand-200"
            strokeWidth="3"
            strokeLinecap="round"
          />
        )}
        {has("implant") && (
          <path
            d="M14 30 L26 30 M15 25 L25 25 M16 20 L24 20 M20 10 L20 34"
            className="stroke-brand-800 dark:stroke-brand-200"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        )}
        {has("bridge") && (
          <path d="M0 6 L40 6" className="stroke-accent-700" strokeWidth="3" />
        )}
        {has("fracture") && (
          <path
            d="M9 6 L18 16 L13 22 L24 32"
            className="fill-none stroke-accent-800 dark:stroke-accent-300"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        )}
        {(missing || has("extract")) && (
          <path
            d="M6 6 L34 34 M34 6 L6 34"
            className={
              missing ? "stroke-muted-foreground" : "stroke-accent-700"
            }
            strokeWidth="3"
            strokeLinecap="round"
          />
        )}
      </svg>
      <span className="flex h-3 items-center gap-0.5">
        {has("mobile") && (
          <span className="text-[9px] font-extrabold text-accent-700 dark:text-accent-300">
            M
          </span>
        )}
        {planned > 0 && <span className="size-2 rounded-full bg-accent-500" />}
      </span>
    </button>
  );
}

export function ToothChart({
  patientId,
  visitId = null,
  ageYears,
  initialTeeth,
  work,
  canBill,
  doctorId,
}: {
  patientId: number;
  visitId?: number | null;
  ageYears: number | null;
  initialTeeth: ToothState[];
  work: DentalWork[];
  // May add a finished job's fee to what the patient owes.
  canBill: boolean;
  doctorId: number | null;
}) {
  const { t, money, date } = useI18n();
  const d = t.dental;
  const router = useRouter();
  const [dentition, setDentition] = useState<Dentition>(
    ageYears !== null && ageYears < 6
      ? "child"
      : ageYears !== null && ageYears < 13
        ? "mixed"
        : "adult",
  );
  const [teeth, setTeeth] = useState(
    () => new Map(initialTeeth.map((x) => [x.tooth, x])),
  );
  const [selected, setSelected] = useState<number | null>(null);
  const plannedByTooth = useMemo(() => {
    const m = new Map<number, number>();
    for (const w of work)
      if (w.status === "planned" && w.tooth)
        m.set(w.tooth, (m.get(w.tooth) ?? 0) + 1);
    return m;
  }, [work]);

  const rows: number[][] =
    dentition === "adult"
      ? [ADULT_UPPER, ADULT_LOWER]
      : dentition === "child"
        ? [CHILD_UPPER, CHILD_LOWER]
        : [ADULT_UPPER, CHILD_UPPER, CHILD_LOWER, ADULT_LOWER];

  const row = (list: number[], key: string) => {
    const half = list.length / 2;
    return (
      // The chart is drawn as the dentist faces the patient, whatever the
      // page's direction.
      <div
        key={key}
        dir="ltr"
        className="grid gap-0.5 sm:gap-1"
        style={{
          gridTemplateColumns: `repeat(${half}, minmax(0, 1fr)) 6px repeat(${half}, minmax(0, 1fr))`,
        }}
      >
        {list.slice(0, half).map((n) => (
          <ToothDrawing
            key={n}
            tooth={n}
            state={teeth.get(n)}
            planned={plannedByTooth.get(n) ?? 0}
            selected={selected === n}
            onClick={() => setSelected(selected === n ? null : n)}
          />
        ))}
        <span className="mx-auto h-full w-px bg-border" />
        {list.slice(half).map((n) => (
          <ToothDrawing
            key={n}
            tooth={n}
            state={teeth.get(n)}
            planned={plannedByTooth.get(n) ?? 0}
            selected={selected === n}
            onClick={() => setSelected(selected === n ? null : n)}
          />
        ))}
      </div>
    );
  };

  const planned = work.filter((w) => w.status === "planned");
  const done = work.filter((w) => w.status === "done");
  const plannedTotal = planned.reduce((s, w) => s + w.fee, 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="items-center">
          <CardTitle>{d.chart}</CardTitle>
          <Chips
            label={d.dentition}
            value={dentition}
            onChange={setDentition}
            options={(["adult", "mixed", "child"] as Dentition[]).map((v) => ({
              value: v,
              label: d.dentitions[v],
            }))}
          />
        </CardHeader>
        <CardContent className="space-y-3">
          <div
            className={cn(
              "flex justify-between px-1 text-[11px] font-bold text-muted-foreground",
              dentition !== "child" && "sm:min-w-[34rem]",
            )}
            dir="ltr"
          >
            <span>{d.patientRight}</span>
            <span>{d.patientLeft}</span>
          </div>
          <div className="-mx-2 overflow-x-auto px-2 pb-1">
            <div
              className={cn(
                "space-y-2",
                dentition !== "child" && "min-w-[34rem]",
              )}
            >
              {rows.map((r, i) => (
                <div
                  key={i}
                  className={cn(
                    i === rows.length / 2 &&
                      "border-t border-dashed border-border pt-2",
                  )}
                >
                  {row(r, String(i))}
                </div>
              ))}
            </div>
          </div>
          <Legend />
        </CardContent>
      </Card>

      {selected !== null && (
        <ToothPanel
          key={selected}
          patientId={patientId}
          visitId={visitId}
          tooth={selected}
          state={teeth.get(selected)}
          work={work.filter((w) => w.tooth === selected)}
          onSaved={(state) => {
            setTeeth((m) => {
              const next = new Map(m);
              if (state) next.set(selected, state);
              else next.delete(selected);
              return next;
            });
          }}
          onWorkChanged={() => router.refresh()}
        />
      )}

      <Card>
        <CardHeader className="items-center">
          <CardTitle>{d.plan}</CardTitle>
          {plannedTotal > 0 && (
            <Badge variant="accent">{d.planTotal(money(plannedTotal))}</Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          <AddWork
            patientId={patientId}
            visitId={visitId}
            tooth={null}
            onAdded={() => router.refresh()}
          />
          {work.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {d.noWork}
            </p>
          ) : (
            <ul className="space-y-1.5">
              {[...planned, ...done].map((w) => (
                <WorkRow
                  key={w.id}
                  work={w}
                  canBill={canBill}
                  doctorId={doctorId}
                  onChanged={() => router.refresh()}
                  dateText={w.doneAt ? date(w.doneAt) : date(w.createdAt)}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Legend() {
  const { t } = useI18n();
  const d = t.dental;
  const items: [string, string][] = [
    ["bg-accent-500", d.conditions.caries],
    ["bg-brand-500", d.conditions.filling],
    ["border-2 border-accent-600 bg-transparent", d.conditions.crown],
    ["bg-accent-500 size-2", d.planned],
  ];
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {items.map(([cls, label]) => (
        <span key={label} className="flex items-center gap-1.5">
          <span
            className={cn(
              "inline-block size-3 rounded",
              cls,
              cls.includes("size-2") && "rounded-full",
            )}
          />
          {label}
        </span>
      ))}
      <span>✕ {d.conditions.missing}</span>
    </div>
  );
}

function ToothPanel({
  patientId,
  visitId,
  tooth,
  state,
  work,
  onSaved,
  onWorkChanged,
}: {
  patientId: number;
  visitId: number | null;
  tooth: number;
  state?: ToothState;
  work: DentalWork[];
  onSaved: (state: ToothState | null) => void;
  onWorkChanged: () => void;
}) {
  const { t } = useI18n();
  const d = t.dental;
  const [conditions, setConditions] = useState<ToothCondition[]>(
    state?.conditions ?? [],
  );
  const [surfaces, setSurfaces] = useState<ToothState["surfaces"]>(
    state?.surfaces ?? {},
  );
  const [note, setNote] = useState(state?.note ?? "");
  const [busy, setBusy] = useState(false);

  const toggle = (c: ToothCondition) =>
    setConditions((l) =>
      l.includes(c) ? l.filter((x) => x !== c) : [...l, c],
    );
  const toggleSurface = (c: ToothCondition, s: Surface) =>
    setSurfaces((m) => {
      const list = m[c] ?? [];
      return {
        ...m,
        [c]: list.includes(s) ? list.filter((x) => x !== s) : [...list, s],
      };
    });

  const save = async (next?: {
    conditions: ToothCondition[];
    surfaces: ToothState["surfaces"];
    note: string;
  }) => {
    setBusy(true);
    try {
      const body = next ?? { conditions, surfaces, note };
      const res = await sendJson<{ tooth: ToothState | null }>(
        `/api/patients/${patientId}/teeth/${tooth}`,
        "PUT",
        body,
      );
      onSaved(res.tooth);
      toast.success(t.common.saved);
    } catch (err) {
      toast.error(errorMessage(err, t.common.somethingWrong));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="ring-2 ring-primary/30">
      <CardHeader className="items-center">
        <CardTitle>{d.toothTitle(tooth)}</CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setConditions([]);
            setSurfaces({});
            setNote("");
            void save({ conditions: [], surfaces: {}, note: "" });
          }}
        >
          <RotateCcwIcon />
          {d.healthy}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {TOOTH_CONDITIONS.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={conditions.includes(c)}
              onClick={() => toggle(c)}
              className={cn(
                "h-9 cursor-pointer rounded-full px-4 text-sm font-bold transition-colors",
                conditions.includes(c)
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-highlight hover:text-foreground",
              )}
            >
              {d.conditions[c]}
            </button>
          ))}
        </div>
        {SURFACE_CONDITIONS.filter((c) => conditions.includes(c)).map((c) => (
          <div key={c} className="space-y-1.5">
            <p className="text-xs font-bold text-muted-foreground">
              {d.surfacesOf(d.conditions[c])}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {SURFACES.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={surfaces[c]?.includes(s) ?? false}
                  onClick={() => toggleSurface(c, s)}
                  className={cn(
                    "h-8 cursor-pointer rounded-full px-3 text-xs font-bold",
                    surfaces[c]?.includes(s)
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {d.surfaces[s === "o" && !isBackTooth(tooth) ? "i" : s]}
                </button>
              ))}
            </div>
          </div>
        ))}
        <Field label={t.common.notes}>
          {(id) => (
            <Input
              id={id}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={300}
            />
          )}
        </Field>
        <Button onClick={() => save()} disabled={busy}>
          {busy ? t.common.saving : t.common.save}
        </Button>
        <div className="space-y-2 border-t border-border pt-4">
          <p className="text-sm font-extrabold">{d.workOn(tooth)}</p>
          {work.length > 0 && (
            <ul className="space-y-1 text-sm">
              {work.map((w) => (
                <li key={w.id} className="flex items-center gap-2">
                  <Badge variant={w.status === "done" ? "default" : "accent"}>
                    {w.status === "done" ? d.done : d.planned}
                  </Badge>
                  {d.procedures[w.procedure]}
                </li>
              ))}
            </ul>
          )}
          <AddWork
            patientId={patientId}
            visitId={visitId}
            tooth={tooth}
            onAdded={onWorkChanged}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function AddWork({
  patientId,
  visitId,
  tooth,
  onAdded,
}: {
  patientId: number;
  visitId: number | null;
  tooth: number | null;
  onAdded: () => void;
}) {
  const { t } = useI18n();
  const d = t.dental;
  const [procedure, setProcedure] = useState<DentalProcedure>(
    tooth ? "filling" : "cleaning",
  );
  const [fee, setFee] = useState<number | null>(0);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (fee === null) return;
    setBusy(true);
    try {
      await sendJson(`/api/patients/${patientId}/dental-work`, "POST", {
        tooth,
        procedure,
        fee,
        note,
        visitId,
      });
      setNote("");
      setFee(0);
      onAdded();
    } catch (err) {
      toast.error(errorMessage(err, t.common.somethingWrong));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form
      onSubmit={add}
      className="grid grid-cols-2 gap-2 rounded-2xl bg-muted/40 p-2 sm:grid-cols-[1fr_8rem_1fr_auto]"
    >
      <NativeSelect
        value={procedure}
        onChange={(e) => setProcedure(e.target.value as DentalProcedure)}
        aria-label={d.procedure}
      >
        {DENTAL_PROCEDURES.map((p) => (
          <option key={p} value={p}>
            {d.procedures[p]}
          </option>
        ))}
      </NativeSelect>
      <MoneyInput
        cents={fee ?? 0}
        onChange={setFee}
        aria-label={d.fee}
        placeholder={d.fee}
      />
      <Input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={t.common.notes}
        aria-label={t.common.notes}
        maxLength={200}
        className="col-span-2 sm:col-span-1"
      />
      <Button
        type="submit"
        variant="soft"
        disabled={busy || fee === null}
        className="col-span-2 sm:col-span-1"
      >
        <PlusIcon />
        {tooth ? d.addForTooth : d.addWork}
      </Button>
    </form>
  );
}

function WorkRow({
  work,
  canBill,
  doctorId,
  onChanged,
  dateText,
}: {
  work: DentalWork;
  canBill: boolean;
  doctorId: number | null;
  onChanged: () => void;
  dateText: string;
}) {
  const { t, money } = useI18n();
  const d = t.dental;
  const [bill, setBill] = useState(canBill && work.fee > 0);
  const [busy, setBusy] = useState(false);
  const set = async (status: "planned" | "done") => {
    setBusy(true);
    try {
      await sendJson(`/api/dental-work/${work.id}`, "PATCH", {
        status,
        bill: status === "done" && bill,
        doctorId,
      });
      if (status === "done" && bill && work.fee > 0)
        toast.success(d.billed(money(work.fee)));
      onChanged();
    } catch (err) {
      toast.error(errorMessage(err, t.common.somethingWrong));
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    try {
      await sendJson(`/api/dental-work/${work.id}`, "DELETE");
      onChanged();
    } catch (err) {
      toast.error(errorMessage(err, t.common.somethingWrong));
    }
  };
  return (
    <li
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-2xl px-3 py-2.5",
        work.status === "done"
          ? "bg-muted/40"
          : "bg-accent-50 dark:bg-accent-500/10",
      )}
    >
      <span className="tabular flex size-9 shrink-0 items-center justify-center rounded-full bg-card text-xs font-extrabold">
        {work.tooth ?? "—"}
      </span>
      <span className="min-w-[60%] flex-1 sm:min-w-0">
        <span className="block truncate text-sm font-bold">
          {d.procedures[work.procedure]}
          {work.note && (
            <span className="font-normal text-muted-foreground">
              {" "}
              · {work.note}
            </span>
          )}
        </span>
        <span className="block text-xs text-muted-foreground">
          {(work.status === "done" ? d.done : d.planned) + " · " + dateText}
          {work.chargeId ? ` · ${d.inFees}` : ""}
        </span>
      </span>
      {work.fee > 0 && (
        <span className="tabular text-sm font-extrabold">
          {money(work.fee)}
        </span>
      )}
      {work.status === "planned" ? (
        <>
          {canBill && work.fee > 0 && (
            <Label className="flex items-center gap-1.5 text-xs font-semibold">
              <Switch checked={bill} onCheckedChange={setBill} />
              {d.addToFees}
            </Label>
          )}
          <Button size="sm" onClick={() => set("done")} disabled={busy}>
            <CheckIcon />
            {d.markDone}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t.common.delete}
            onClick={remove}
          >
            <Trash2Icon />
          </Button>
        </>
      ) : (
        !work.chargeId && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => set("planned")}
            disabled={busy}
          >
            {d.undo}
          </Button>
        )
      )}
    </li>
  );
}
