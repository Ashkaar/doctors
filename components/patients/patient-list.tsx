"use client";

import { ContactRoundIcon, SearchIcon, UserPlusIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ageOn, type PatientSummary } from "@/lib/clinic";
import { getJson } from "@/lib/clientApi";
import { Empty } from "../clinic/fields";
import { useI18n } from "../i18n-provider";
import { PageBody, PageHeader } from "../page-header";
import { useShop } from "../shop-provider";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { PatientDialog } from "./patient-form";

// The patient list. The search text never goes in the address bar (it
// would end up in the browser's history), only in the request.
export function PatientList({ initial, today, showAlerts }: { initial: PatientSummary[]; today: string; showAlerts: boolean }) {
  const { t, date } = useI18n();
  const p = t.patients;
  const shop = useShop();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [found, setFound] = useState<PatientSummary[] | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const query = q.trim();
    if (!query) return;
    let live = true;
    const timer = setTimeout(async () => {
      try {
        const res = await getJson<{ patients: PatientSummary[] }>(`/api/patients?q=${encodeURIComponent(query)}`);
        if (live) setFound(res.patients);
      } catch {
        if (live) setFound([]);
      }
    }, 200);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [q]);

  const list = q.trim() ? (found ?? []) : initial;

  return (
    <PageBody>
      <PageHeader title={p.title} description={p.intro}>
        <Button onClick={() => setAdding(true)}>
          <UserPlusIcon />
          {p.add}
        </Button>
      </PageHeader>
      <div className="relative max-w-xl">
        <SearchIcon className="pointer-events-none absolute start-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={p.search} aria-label={p.search} className="h-12 rounded-full ps-10 text-base" autoComplete="off" />
      </div>
      {list.length === 0 ? (
        <Empty icon={ContactRoundIcon} text={q.trim() ? p.noMatch : p.none}>
          {!q.trim() && (
            <Button variant="soft" onClick={() => setAdding(true)}>
              {p.add}
            </Button>
          )}
        </Empty>
      ) : (
        <Card className="p-2">
          <ul>
            {list.map((r) => {
              const age = r.birthDate ? ageOn(r.birthDate, today) : null;
              return (
                <li key={r.id}>
                  <Link href={shop.href(`/dashboard/patients/${r.id}`)} className="flex items-center gap-4 rounded-2xl px-3 py-3 transition-colors hover:bg-muted/60">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-base font-extrabold text-primary-soft-foreground">
                      {r.name.slice(0, 1)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold">{r.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {p.fileNo(r.fileNo)}
                        {age !== null && ` · ${p.ageShort(age)}`}
                        {r.phone && <span dir="ltr"> · {r.phone}</span>}
                      </span>
                    </span>
                    <span className="hidden text-xs text-muted-foreground sm:block">{r.lastVisitAt ? p.lastVisit(date(r.lastVisitAt)) : p.neverSeen}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
      {adding && (
        <PatientDialog
          open={adding}
          onOpenChange={setAdding}
          showAlerts={showAlerts}
          today={today}
          initialName={/\d/.test(q) ? "" : q}
          onSaved={(patient) => router.push(shop.href(`/dashboard/patients/${patient.id}`))}
        />
      )}
    </PageBody>
  );
}
