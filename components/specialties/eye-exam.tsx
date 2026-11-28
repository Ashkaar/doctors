"use client";

import { GlassesIcon, SaveIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { errorMessage, sendJson } from "@/lib/clientApi";
import { toLatinDigits } from "@/lib/format";
import { formatPower, parsePower, type EyeExam, type EyeSide } from "@/lib/specialties";
import { useI18n } from "../i18n-provider";
import { useShop } from "../shop-provider";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";

type SideText = { vaUnaided: string; vaCorrected: string; sph: string; cyl: string; axis: string; add: string; iop: string; anterior: string; posterior: string };

const toText = (s: EyeSide): SideText => ({
  vaUnaided: s.vaUnaided,
  vaCorrected: s.vaCorrected,
  sph: formatPower(s.sph),
  cyl: formatPower(s.cyl),
  axis: s.axis === null ? "" : String(s.axis),
  add: s.add === null ? "" : formatPower(s.add),
  iop: s.iop === null ? "" : String(s.iop),
  anterior: s.anterior,
  posterior: s.posterior,
});

const int = (v: string, max: number): number | null | undefined => {
  const t = toLatinDigits(v).trim();
  if (!t) return null;
  if (!/^\d+$/.test(t)) return undefined;
  const n = Number(t);
  return n <= max ? n : undefined;
};

function fromText(s: SideText): EyeSide | null {
  const sph = parsePower(toLatinDigits(s.sph));
  const cyl = parsePower(toLatinDigits(s.cyl));
  const add = parsePower(toLatinDigits(s.add));
  const axis = int(s.axis, 180);
  const iop = int(s.iop, 90);
  if ([sph, cyl, add, axis, iop].includes(undefined) || (add !== null && add! < 0)) return null;
  return { vaUnaided: s.vaUnaided.trim(), vaCorrected: s.vaCorrected.trim(), sph: sph!, cyl: cyl!, add: add!, axis: axis!, iop: iop!, anterior: s.anterior, posterior: s.posterior };
}

// The eye exam of one visit: right eye (OD) and left eye (OS) side by side.
export function EyeExamForm({ visitId, initial }: { visitId: number; initial: EyeExam }) {
  const { t } = useI18n();
  const e = t.eye;
  const shop = useShop();
  const [od, setOd] = useState(() => toText(initial.od));
  const [os, setOs] = useState(() => toText(initial.os));
  const [pd, setPd] = useState(initial.pd === null ? "" : String(initial.pd));
  const [notes, setNotes] = useState(initial.notes);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(Boolean(initial.od.sph !== null || initial.os.sph !== null || initial.od.vaUnaided || initial.os.vaUnaided));

  const save = async () => {
    const right = fromText(od);
    const left = fromText(os);
    const pdValue = int(pd, 90);
    if (!right || !left || pdValue === undefined || (pdValue !== null && pdValue < 30)) return toast.error(e.check);
    setBusy(true);
    try {
      await sendJson(`/api/visits/${visitId}/eye`, "PUT", { od: right, os: left, pd: pdValue, notes });
      setSaved(true);
      toast.success(t.common.saved);
    } catch (err) {
      toast.error(errorMessage(err, t.common.somethingWrong));
    } finally {
      setBusy(false);
    }
  };

  const rows: { key: keyof SideText; label: string; hint?: string }[] = [
    { key: "vaUnaided", label: e.vaUnaided, hint: "6/6" },
    { key: "vaCorrected", label: e.vaCorrected, hint: "6/6" },
    { key: "sph", label: e.sph, hint: "-1.25" },
    { key: "cyl", label: e.cyl, hint: "-0.50" },
    { key: "axis", label: e.axis, hint: "90" },
    { key: "add", label: e.add, hint: "+2.00" },
    { key: "iop", label: e.iop, hint: "15" },
  ];

  return (
    <Card>
      <CardHeader className="items-center">
        <CardTitle>{e.title}</CardTitle>
        {saved && (
          <Button asChild variant="outline" size="sm">
            <Link href={shop.href(`/dashboard/visits/${visitId}/glasses`)} target="_blank">
              <GlassesIcon />
              {e.printGlasses}
            </Link>
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[22rem] text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground">
                <th className="pb-2 text-start font-semibold" />
                <th className="pb-2 font-extrabold text-foreground">{e.od}</th>
                <th className="pb-2 font-extrabold text-foreground">{e.os}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <th scope="row" className="py-1 pe-2 text-start text-xs font-semibold text-muted-foreground">
                    {r.label}
                  </th>
                  {[
                    [od, setOd],
                    [os, setOs],
                  ].map(([side, set], i) => (
                    <td key={i} className="px-1 py-1">
                      <Input
                        value={(side as SideText)[r.key]}
                        onChange={(ev) => (set as React.Dispatch<React.SetStateAction<SideText>>)((p) => ({ ...p, [r.key]: ev.target.value }))}
                        placeholder={r.hint}
                        dir="ltr"
                        className="h-9 text-center font-bold"
                        aria-label={`${i === 0 ? e.od : e.os} ${r.label}`}
                        inputMode={r.key.startsWith("va") ? "text" : "decimal"}
                        autoComplete="off"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(["anterior", "posterior"] as const).map((k) => (
            <div key={k} className="space-y-2">
              <p className="text-xs font-bold text-muted-foreground">{e[k]}</p>
              <Textarea value={od[k]} onChange={(ev) => setOd((p) => ({ ...p, [k]: ev.target.value }))} placeholder={e.od} className="min-h-14" maxLength={1000} aria-label={`${e.od} ${e[k]}`} />
              <Textarea value={os[k]} onChange={(ev) => setOs((p) => ({ ...p, [k]: ev.target.value }))} placeholder={e.os} className="min-h-14" maxLength={1000} aria-label={`${e.os} ${e[k]}`} />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-[8rem_1fr] gap-3">
          <label className="space-y-1.5">
            <span className="text-xs font-bold text-muted-foreground">{e.pd}</span>
            <Input value={pd} onChange={(ev) => setPd(ev.target.value)} placeholder="63" inputMode="numeric" dir="ltr" className="text-center font-bold" />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-bold text-muted-foreground">{t.common.notes}</span>
            <Input value={notes} onChange={(ev) => setNotes(ev.target.value)} maxLength={2000} />
          </label>
        </div>
        <Button onClick={save} disabled={busy}>
          <SaveIcon />
          {busy ? t.common.saving : e.save}
        </Button>
      </CardContent>
    </Card>
  );
}

// Past exams, newest first (patient file).
export function EyeHistory({ exams }: { exams: { visitId: number; at: number; exam: EyeExam }[] }) {
  const { t, date } = useI18n();
  const e = t.eye;
  const shop = useShop();
  const rx = (s: EyeSide) => [formatPower(s.sph), s.cyl ? `${formatPower(s.cyl)} × ${s.axis ?? "—"}` : "", s.add ? `Add ${formatPower(s.add)}` : ""].filter(Boolean).join("  ") || "—";
  return (
    <Card className="p-2">
      {exams.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{e.none}</p>
      ) : (
        <ul className="space-y-1">
          {exams.map((x) => (
            <li key={x.visitId}>
              <Link href={shop.href(`/dashboard/visits/${x.visitId}`)} className="block rounded-2xl px-3 py-3 hover:bg-muted/60">
                <span className="block text-sm font-extrabold">{date(x.at)}</span>
                <span className="mt-1 grid grid-cols-[2.5rem_1fr_auto] gap-x-3 gap-y-0.5 text-xs" dir="ltr">
                  {(["od", "os"] as const).map((k) => (
                    <span key={k} className="contents">
                      <span className="font-bold text-muted-foreground">{k.toUpperCase()}</span>
                      <span className="tabular font-semibold">{rx(x.exam[k])}</span>
                      <span className="tabular text-muted-foreground">
                        {x.exam[k].vaCorrected || x.exam[k].vaUnaided}
                        {x.exam[k].iop !== null ? ` · ${x.exam[k].iop} mmHg` : ""}
                      </span>
                    </span>
                  ))}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
