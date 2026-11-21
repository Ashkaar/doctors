"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { addDays } from "@/lib/format";
import type { Report } from "@/lib/reports";
import { cn } from "@/lib/utils";
import { Field } from "../clinic/fields";
import { useI18n } from "../i18n-provider";
import { PageBody, PageHeader } from "../page-header";
import { useShop } from "../shop-provider";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";

export function ReportsScreen({ report, from, last, today, withShares, withExpenses }: { report: Report; from: string; last: string; today: string; withShares: boolean; withExpenses: boolean }) {
  const { t, money, day: dayText } = useI18n();
  const r = t.reports;
  const shop = useShop();
  const router = useRouter();
  const [f, setF] = useState(from);
  const [l, setL] = useState(last);
  const go = (a: string, b: string) => router.push(shop.href(`/dashboard/reports?from=${a}&to=${b}`));

  const monthStart = today.slice(0, 7) + "-01";
  const prevStart = addDays(monthStart, -1).slice(0, 7) + "-01";
  const presets = [
    { label: r.thisMonth, a: monthStart, b: today },
    { label: r.lastMonth, a: prevStart, b: addDays(monthStart, -1) },
    { label: r.thisYear, a: `${today.slice(0, 4)}-01-01`, b: today },
  ];

  const tiles = [
    { label: r.net, value: report.net, main: true, hint: r.netText },
    { label: r.collected, value: report.collected },
    { label: r.billed, value: report.billed },
    ...(withExpenses ? [{ label: r.expenses, value: report.expenses }] : []),
    ...(withShares ? [{ label: r.shares, value: report.shares }] : []),
    { label: r.discounts, value: report.discounts },
  ];
  const maxDay = Math.max(1, ...report.byDay.map((d) => Math.max(d.billed, d.collected)));

  return (
    <PageBody>
      <PageHeader title={r.title} description={`${dayText(from)} – ${dayText(last)}`} />
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => go(p.a, p.b)}
              className={cn("h-9 cursor-pointer rounded-full px-4 text-sm font-bold", from === p.a && last === p.b ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground")}
            >
              {p.label}
            </button>
          ))}
        </div>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (f && l && f <= l) go(f, l);
          }}
        >
          <Field label={r.from}>{(id) => <Input id={id} type="date" value={f} max={today} onChange={(e) => setF(e.target.value)} className="w-auto" />}</Field>
          <Field label={r.to}>{(id) => <Input id={id} type="date" value={l} max={today} onChange={(e) => setL(e.target.value)} className="w-auto" />}</Field>
          <Button type="submit" variant="soft">
            {t.common.open}
          </Button>
        </form>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {tiles.map((x) => (
          <div key={x.label} className={cn("rounded-2xl p-4 shadow-soft", x.main ? "bg-primary text-primary-foreground" : "bg-card")}>
            <p className="tabular truncate text-2xl font-extrabold">{money(x.value)}</p>
            <p className={cn("text-xs font-semibold", x.main ? "opacity-85" : "text-muted-foreground")}>{x.label}</p>
            {x.hint && <p className="mt-1 text-[11px] opacity-75">{x.hint}</p>}
          </div>
        ))}
        <div className="rounded-2xl bg-card p-4 shadow-soft">
          <p className="tabular text-2xl font-extrabold">{report.visits}</p>
          <p className="text-xs font-semibold text-muted-foreground">{r.visits}</p>
        </div>
        <div className="rounded-2xl bg-card p-4 shadow-soft">
          <p className="tabular text-2xl font-extrabold">{report.newPatients}</p>
          <p className="text-xs font-semibold text-muted-foreground">{r.newPatients}</p>
        </div>
      </div>

      {report.byDay.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{r.byDay}</CardTitle>
            <div className="flex gap-4 text-xs font-semibold text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-primary" />
                {r.collected}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-brand-300" />
                {r.billed}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex h-44 items-end gap-1 overflow-x-auto" dir="ltr" role="img" aria-label={r.byDay}>
              {report.byDay.map((d) => (
                <div key={d.day} className="group flex min-w-3 flex-1 flex-col items-center gap-1" title={`${dayText(d.day)}: ${money(d.collected)} / ${money(d.billed)}`}>
                  <div className="flex h-36 w-full items-end justify-center gap-px">
                    <span className="w-1/2 max-w-3 rounded-t-full bg-primary" style={{ height: `${(d.collected / maxDay) * 100}%` }} />
                    <span className="w-1/2 max-w-3 rounded-t-full bg-brand-300" style={{ height: `${(d.billed / maxDay) * 100}%` }} />
                  </div>
                  <span className="tabular text-[10px] text-muted-foreground">{Number(d.day.slice(8))}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Table
          title={r.byDoctor}
          head={[t.doctors.pick, r.visits, r.billed, ...(withShares ? [r.share] : [])]}
          rows={report.byDoctor.map((d) => [d.name || r.noDoctor, String(d.visits), money(d.billed), ...(withShares ? [money(d.share)] : [])])}
          empty={r.empty}
        />
        <Table title={r.byService} head={[t.payments.service, r.count, r.billed]} rows={report.byService.map((s) => [s.name, String(s.count), money(s.billed)])} empty={r.empty} />
        <Table
          title={r.byMethod}
          head={[t.payments.method, r.collected]}
          rows={Object.entries(report.byMethod).map(([k, v]) => [t.payments.methods[k as keyof typeof t.payments.methods] ?? k, money(v)])}
          empty={r.empty}
        />
        {withExpenses && <Table title={r.byCategory} head={[t.expenses.category, r.expenses]} rows={report.byCategory.map((c) => [c.category || "—", money(c.amount)])} empty={r.empty} />}
      </div>
    </PageBody>
  );
}

function Table({ title, head, rows, empty }: { title: string; head: string[]; rows: string[][]; empty: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {rows.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{empty}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground">
                {head.map((h, i) => (
                  <th key={h} className={cn("pb-2 font-semibold", i === 0 ? "text-start" : "text-end")}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-t border-border">
                  {row.map((c, j) => (
                    <td key={j} className={cn("py-2", j === 0 ? "font-bold" : "tabular text-end")}>
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
