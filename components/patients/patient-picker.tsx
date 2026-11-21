"use client";

import { SearchIcon, UserPlusIcon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { ageOn, type Patient, type PatientSummary } from "@/lib/clinic";
import { getJson } from "@/lib/clientApi";
import { useI18n } from "../i18n-provider";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { PatientDialog } from "./patient-form";

// Choose a patient by name, phone or file number, or add a new one.
export function PatientPicker({
  value,
  onChange,
  today,
  showAlerts,
}: {
  value: PatientSummary | null;
  onChange: (patient: PatientSummary | null) => void;
  today: string;
  showAlerts: boolean;
}) {
  const { t } = useI18n();
  const p = t.patients;
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PatientSummary[]>([]);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (value) return;
    const query = q.trim();
    if (!query) return;
    let live = true;
    const timer = setTimeout(async () => {
      try {
        const res = await getJson<{ patients: PatientSummary[] }>(`/api/patients?q=${encodeURIComponent(query)}`);
        if (live) setResults(res.patients.slice(0, 8));
      } catch {
        if (live) setResults([]);
      }
    }, 200);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [q, value]);

  const shown = q.trim() ? results : [];

  if (value) {
    const age = value.birthDate ? ageOn(value.birthDate, today) : null;
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-primary-soft px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-primary-soft-foreground">{value.name}</p>
          <p className="text-xs text-muted-foreground">
            {p.fileNo(value.fileNo)}
            {age !== null && ` · ${p.age(age)}`}
            {value.phone && <span dir="ltr"> · {value.phone}</span>}
          </p>
        </div>
        <Button type="button" variant="ghost" size="icon-sm" aria-label={t.common.close} onClick={() => onChange(null)}>
          <XIcon />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={p.search} className="ps-9" autoComplete="off" aria-label={p.search} />
      </div>
      {shown.length > 0 && (
        <ul className="max-h-60 overflow-y-auto rounded-2xl bg-muted/50 p-1">
          {shown.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => onChange(r)}
                className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-start hover:bg-card"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{r.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {p.fileNo(r.fileNo)}
                    {r.phone && <span dir="ltr"> · {r.phone}</span>}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {q.trim() && results.length === 0 && <p className="px-1 text-xs text-muted-foreground">{p.noMatch}</p>}
      <Button type="button" variant="soft" size="sm" onClick={() => setAdding(true)}>
        <UserPlusIcon />
        {p.pickNew}
      </Button>
      {adding && (
        <PatientDialog
          open={adding}
          onOpenChange={setAdding}
          showAlerts={showAlerts}
          today={today}
          initialName={/\d/.test(q) ? "" : q}
          onSaved={(patient: Patient) => onChange(patient)}
        />
      )}
    </div>
  );
}
