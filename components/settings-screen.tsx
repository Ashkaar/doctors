"use client";

import { ArrowUpRightIcon, CopyIcon, DownloadIcon, KeyRoundIcon, LockIcon, MonitorIcon, MoonIcon, PencilIcon, PlusIcon, SunIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import type { Service } from "@/lib/clinic";
import { minutesToTime, timeToMinutes } from "@/lib/clinic";
import type { HoursSettings, PrintSettings } from "@/lib/clinicSettings";
import { errorMessage, sendJson } from "@/lib/clientApi";
import { LANG_CODES, LANGUAGES, type Lang } from "@/lib/i18n";
import type { Feature } from "@/lib/plans";
import type { Viewer } from "@/lib/sections";
import type { PlanId, ShopState } from "@/lib/shopState";
import { cn } from "@/lib/utils";
import { Chips, Field } from "./clinic/fields";
import { FormError } from "./form-error";
import { useI18n } from "./i18n-provider";
import { saveLanguage } from "./language";
import { MoneyInput } from "./money-input";
import { PageBody, PageHeader } from "./page-header";
import { useShop } from "./shop-provider";
import { useTheme, type ThemeChoice } from "./theme";
import { TimeZoneCard } from "./time-zone-card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
import { Textarea } from "./ui/textarea";

export interface ClinicFacts {
  name: string;
  branch: string;
  currency: string;
  plan: PlanId | null;
  state: ShopState | null;
  accountUrl: string | null;
}

export function SettingsScreen({
  viewer,
  clinic,
  features,
  services,
  print,
  hours,
  screenKey,
}: {
  viewer: Viewer;
  clinic: ClinicFacts;
  features: readonly Feature[];
  services: Service[];
  print: PrintSettings;
  hours: HoursSettings;
  screenKey: string | null;
}) {
  const { t, lang } = useI18n();
  const s = t.settings;
  const router = useRouter();
  const { href } = useShop();
  const [theme, setTheme] = useTheme();
  const owner = viewer.isOwner;

  const choose = (next: Lang) => {
    saveLanguage(next);
    router.refresh();
  };
  const lock = async () => {
    try {
      await sendJson("/api/unlock", "DELETE");
      toast.success(t.unlock.locked);
      router.refresh();
    } catch {
      toast.error(t.common.somethingWrong);
    }
  };

  const option = (selected: boolean) =>
    cn(
      "flex h-11 cursor-pointer items-center justify-center gap-2 rounded-full px-3 text-sm font-bold transition-colors",
      selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-highlight hover:text-foreground",
    );

  const themes: { value: ThemeChoice; label: string; icon: typeof SunIcon }[] = [
    { value: "light", label: t.header.light, icon: SunIcon },
    { value: "dark", label: t.header.dark, icon: MoonIcon },
    { value: "system", label: t.header.system, icon: MonitorIcon },
  ];

  const rows: [string, string][] = [
    [s.clinicName, clinic.name],
    ...(clinic.branch ? ([[s.branch, clinic.branch]] as [string, string][]) : []),
    [s.currency, clinic.currency],
    ...(clinic.state ? ([[s.status, t.states[clinic.state]]] as [string, string][]) : []),
    ...(clinic.state ? ([[s.plan, clinic.plan ? t.plans[clinic.plan] : t.plans.none]] as [string, string][]) : []),
  ];

  return (
    <PageBody>
      <PageHeader title={s.title} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{s.appearance}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <p className="text-sm font-semibold">{s.theme}</p>
                <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={s.theme}>
                  {themes.map(({ value, label, icon: Icon }) => (
                    <button key={value} type="button" role="radio" aria-checked={theme === value} className={option(theme === value)} onClick={() => setTheme(value)}>
                      <Icon className="size-4 shrink-0" />
                      <span className="truncate">{label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-semibold">{s.language}</p>
                <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={s.language}>
                  {LANG_CODES.map((code) => (
                    <button key={code} type="button" role="radio" aria-checked={lang === code} lang={LANGUAGES[code].html} dir={LANGUAGES[code].dir} className={option(lang === code)} onClick={() => choose(code)}>
                      {LANGUAGES[code].label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">{s.languageNote}</p>
              </div>
            </CardContent>
          </Card>
          {owner && <ServicesCard services={services} />}
          {owner && <HoursCard hours={hours} />}
          {owner && features.includes("prescriptions") && <PrintCard print={print} />}
        </div>

        <div className="space-y-4">
          {owner && <ScreenCard initialKey={screenKey} />}
          <TimeZoneCard canChange={owner} />
          <Card>
            <CardHeader>
              <div>
                <CardTitle>{s.clinic}</CardTitle>
                {clinic.accountUrl && <CardDescription className="mt-1">{s.clinicNote}</CardDescription>}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl className="divide-y divide-border rounded-2xl bg-muted/40 text-sm">
                {rows.map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-4 px-4 py-2.5">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="truncate font-bold">{value}</dd>
                  </div>
                ))}
              </dl>
              {clinic.accountUrl && viewer.kind === "owner" && (
                <Button asChild variant="outline" className="w-full">
                  <a href={clinic.accountUrl}>
                    {s.manage}
                    <ArrowUpRightIcon className="rtl:-scale-x-100" />
                  </a>
                </Button>
              )}
            </CardContent>
          </Card>
          {owner && <ExportCard allowed={features.includes("export")} />}
          {(viewer.kind === "owner" || viewer.unlocked) && (
            <Card>
              <CardHeader>
                <CardTitle>{s.security}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {viewer.kind === "owner" && (
                  <Button asChild variant="outline" className="w-full justify-start">
                    <Link href={href("/owner-password")}>
                      <KeyRoundIcon />
                      {s.changeOwnerPassword}
                    </Link>
                  </Button>
                )}
                {viewer.unlocked && (
                  <Button variant="outline" className="w-full justify-start" onClick={lock}>
                    <LockIcon />
                    {s.lockDevice}
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </PageBody>
  );
}

function ServicesCard({ services }: { services: Service[] }) {
  const { t, money } = useI18n();
  const s = t.settings;
  const router = useRouter();
  const [editing, setEditing] = useState<Service | "new" | null>(null);
  return (
    <Card>
      <CardHeader className="items-center">
        <div>
          <CardTitle>{s.services}</CardTitle>
          <CardDescription className="mt-1">{s.servicesText}</CardDescription>
        </div>
        <Button size="sm" variant="soft" onClick={() => setEditing("new")}>
          <PlusIcon />
          {s.serviceAdd}
        </Button>
      </CardHeader>
      <CardContent>
        {services.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{s.noServices}</p>
        ) : (
          <ul className="space-y-1">
            {services.map((x) => (
              <li key={x.id} className={cn("flex items-center gap-3 rounded-2xl bg-muted/40 px-4 py-2.5", !x.active && "opacity-60")}>
                <span className="min-w-0 flex-1 truncate text-sm font-bold">{x.name}</span>
                <span className="tabular text-sm font-extrabold">{money(x.price)}</span>
                <Button variant="ghost" size="icon-sm" aria-label={t.common.edit} onClick={() => setEditing(x)}>
                  <PencilIcon />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      {editing && <ServiceDialog service={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); router.refresh(); }} />}
    </Card>
  );
}

function ServiceDialog({ service, onClose, onSaved }: { service: Service | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useI18n();
  const s = t.settings;
  const [name, setName] = useState(service?.name ?? "");
  const [price, setPrice] = useState<number | null>(service?.price ?? 0);
  const [active, setActive] = useState(service?.active ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (price === null) return;
    setBusy(true);
    setError(null);
    try {
      const body = { name, price, active };
      if (service) await sendJson(`/api/services/${service.id}`, "PATCH", body);
      else await sendJson("/api/services", "POST", body);
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
          <DialogTitle>{service ? service.name : s.serviceAdd}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Field label={s.serviceName}>{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder={s.serviceNamePlaceholder} maxLength={80} required autoFocus />}</Field>
          <Field label={s.servicePrice}>{(id) => <MoneyInput id={id} cents={price ?? 0} onChange={setPrice} />}</Field>
          <Label className="flex items-center justify-between rounded-2xl bg-muted/50 px-4 py-3">
            {s.serviceActive}
            <Switch checked={active} onCheckedChange={setActive} />
          </Label>
          <FormError message={error} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t.common.cancel}
            </Button>
            <Button type="submit" disabled={busy || !name.trim() || price === null}>
              {busy ? t.common.saving : t.common.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function HoursCard({ hours }: { hours: HoursSettings }) {
  const { t } = useI18n();
  const s = t.settings;
  const [from, setFrom] = useState(minutesToTime(hours.startMin));
  const [to, setTo] = useState(minutesToTime(Math.min(hours.endMin, 23 * 60 + 59)));
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const startMin = timeToMinutes(from);
    const endMin = timeToMinutes(to);
    if (startMin === null || endMin === null || endMin <= startMin) return toast.error(t.errors.invalid);
    setBusy(true);
    try {
      await sendJson("/api/settings/clinic", "PUT", { hours: { startMin, endMin } });
      toast.success(t.common.saved);
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
          <CardTitle>{s.hours}</CardTitle>
          <CardDescription className="mt-1">{s.hoursText}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex flex-wrap items-end gap-3">
        <Field label={s.hoursFrom}>{(id) => <Input id={id} type="time" value={from} onChange={(e) => setFrom(e.target.value)} dir="ltr" className="w-32" />}</Field>
        <Field label={s.hoursTo}>{(id) => <Input id={id} type="time" value={to} onChange={(e) => setTo(e.target.value)} dir="ltr" className="w-32" />}</Field>
        <Button variant="soft" onClick={save} disabled={busy}>
          {t.common.save}
        </Button>
      </CardContent>
    </Card>
  );
}

function PrintCard({ print }: { print: PrintSettings }) {
  const { t } = useI18n();
  const s = t.settings;
  const [paper, setPaper] = useState(print.paper);
  const [header, setHeader] = useState(print.header);
  const [footer, setFooter] = useState(print.footer);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await sendJson("/api/settings/clinic", "PUT", { print: { paper, header, footer } });
      toast.success(t.common.saved);
    } catch (err) {
      toast.error(errorMessage(err, t.common.somethingWrong));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>{s.printing}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-semibold">{s.paper}</p>
          <Chips label={s.paper} value={paper} onChange={setPaper} options={[{ value: "a5", label: s.paperA5 }, { value: "a4", label: s.paperA4 }]} />
        </div>
        <Field label={s.printHeader}>{(id) => <Textarea id={id} value={header} onChange={(e) => setHeader(e.target.value)} placeholder={s.printHeaderPlaceholder} maxLength={300} className="min-h-16" />}</Field>
        <Field label={s.printFooter}>{(id) => <Textarea id={id} value={footer} onChange={(e) => setFooter(e.target.value)} placeholder={s.printFooterPlaceholder} maxLength={300} className="min-h-16" />}</Field>
        <Button variant="soft" onClick={save} disabled={busy}>
          {t.common.save}
        </Button>
      </CardContent>
    </Card>
  );
}

function ScreenCard({ initialKey }: { initialKey: string | null }) {
  const { t } = useI18n();
  const s = t.settings;
  const { href } = useShop();
  const [key, setKey] = useState(initialKey);
  const [busy, setBusy] = useState(false);
  const link = key ? `${typeof window === "undefined" ? "" : window.location.origin}${href(`/screen?key=${key}`)}` : "";
  const make = async () => {
    setBusy(true);
    try {
      const res = await sendJson<{ key: string }>("/api/settings/screen", "POST");
      setKey(res.key);
    } catch (err) {
      toast.error(errorMessage(err, t.common.somethingWrong));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card id="screen">
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2">
            <MonitorIcon className="size-4 text-primary" />
            {s.screen}
          </CardTitle>
          <CardDescription className="mt-1">{s.screenText}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {key ? (
          <>
            <p className="truncate rounded-2xl bg-muted/50 px-4 py-2.5 font-mono text-xs" dir="ltr" suppressHydrationWarning>
              {link}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <a href={href(`/screen?key=${key}`)} target="_blank" rel="noreferrer">
                  {s.screenOpen}
                </a>
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(link);
                    toast.success(s.copied);
                  } catch {
                    toast.error(t.common.somethingWrong);
                  }
                }}
              >
                <CopyIcon />
                {s.screenCopy}
              </Button>
              <Button variant="ghost" onClick={make} disabled={busy}>
                {s.screenNew}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{s.screenNewText}</p>
          </>
        ) : (
          <Button onClick={make} disabled={busy}>
            {s.screenMake}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function ExportCard({ allowed }: { allowed: boolean }) {
  const { t } = useI18n();
  const s = t.settings;
  const { href } = useShop();
  const tables = ["patients", "visits", "appointments", "charges", "payments", "expenses"] as const;
  return (
    <Card>
      <CardHeader className="items-center">
        <div>
          <CardTitle>{s.export}</CardTitle>
          <CardDescription className="mt-1">{s.exportText}</CardDescription>
        </div>
        {!allowed && <Badge variant="accent">{t.common.notInPlan}</Badge>}
      </CardHeader>
      <CardContent className="space-y-3">
        {allowed ? (
          <>
            <Button asChild>
              <a href={href("/api/export?format=json")}>
                <DownloadIcon />
                {s.exportAll}
              </a>
            </Button>
            <div>
              <p className="mb-2 text-sm font-semibold">{s.exportCsv}</p>
              <div className="flex flex-wrap gap-2">
                {tables.map((x) => (
                  <Button key={x} asChild variant="outline" size="sm">
                    <a href={href(`/api/export?format=csv&table=${x}`)}>{s.exportTables[x]}</a>
                  </Button>
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{s.exportNote}</p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{t.common.upgrade}</p>
        )}
      </CardContent>
    </Card>
  );
}
