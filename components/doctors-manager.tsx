"use client";

import { PencilIcon, PlusIcon, StethoscopeIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import type { Doctor } from "@/lib/clinic";
import { errorMessage, sendJson } from "@/lib/clientApi";
import { toLatinDigits } from "@/lib/format";
import { Empty, Field, NativeSelect } from "./clinic/fields";
import { FormError } from "./form-error";
import { useI18n } from "./i18n-provider";
import { PageBody, PageHeader } from "./page-header";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";

export function DoctorsManager({ initial, logins, many, shares }: { initial: Doctor[]; logins: { id: number; name: string }[]; many: boolean; shares: boolean }) {
  const { t } = useI18n();
  const d = t.doctors;
  const router = useRouter();
  const [editing, setEditing] = useState<Doctor | "new" | null>(null);
  const activeCount = initial.filter((x) => x.active).length;

  return (
    <PageBody>
      <PageHeader title={d.title} description={d.intro}>
        <Button onClick={() => setEditing("new")}>
          <PlusIcon />
          {d.add}
        </Button>
      </PageHeader>
      {!many && activeCount >= 1 && <p className="rounded-2xl bg-accent-100 px-4 py-3 text-sm font-semibold text-accent-900 dark:bg-accent-500/15 dark:text-accent-200">{d.limit}</p>}
      {initial.length === 0 ? (
        <Empty icon={StethoscopeIcon} text={d.none}>
          <Button variant="soft" onClick={() => setEditing("new")}>
            {d.add}
          </Button>
        </Empty>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {initial.map((doc) => (
            <Card key={doc.id} className="flex items-start gap-3 p-4">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-soft-foreground">
                <StethoscopeIcon className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-extrabold">{doc.name}</p>
                <p className="truncate text-xs text-muted-foreground">{[doc.specialty, doc.room ? d.roomShort(doc.room) : ""].filter(Boolean).join(" · ") || "—"}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge variant={doc.active ? "default" : "neutral"}>{doc.active ? d.active : d.inactive}</Badge>
                  {doc.staffId && <Badge variant="neutral">{logins.find((l) => l.id === doc.staffId)?.name ?? d.login}</Badge>}
                  {shares && doc.shareBp > 0 && <Badge variant="neutral">{doc.shareBp / 100}%</Badge>}
                </div>
              </div>
              <Button variant="ghost" size="icon-sm" aria-label={d.editTitle(doc.name)} onClick={() => setEditing(doc)}>
                <PencilIcon />
              </Button>
            </Card>
          ))}
        </div>
      )}
      {editing && (
        <DoctorDialog
          doctor={editing === "new" ? null : editing}
          logins={logins}
          shares={shares}
          onClose={() => setEditing(null)}
          onSaved={() => {
            toast.success(t.common.saved);
            setEditing(null);
            router.refresh();
          }}
        />
      )}
    </PageBody>
  );
}

function DoctorDialog({ doctor, logins, shares, onClose, onSaved }: { doctor: Doctor | null; logins: { id: number; name: string }[]; shares: boolean; onClose: () => void; onSaved: () => void }) {
  const { t } = useI18n();
  const d = t.doctors;
  const [form, setForm] = useState({
    name: doctor?.name ?? "",
    specialty: doctor?.specialty ?? "",
    phone: doctor?.phone ?? "",
    licence: doctor?.licence ?? "",
    room: doctor?.room ?? "",
    staffId: doctor?.staffId ?? null,
    share: doctor ? String(doctor.shareBp / 100) : "0",
    slot: String(doctor?.slotMinutes ?? 15),
    active: doctor?.active ?? true,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const share = Math.round(Math.min(100, Math.max(0, Number(toLatinDigits(form.share)) || 0)) * 100);
      const body = {
        name: form.name,
        specialty: form.specialty,
        phone: toLatinDigits(form.phone),
        licence: form.licence,
        room: form.room,
        staffId: form.staffId,
        shareBp: share,
        slotMinutes: Math.min(240, Math.max(5, Number(toLatinDigits(form.slot)) || 15)),
        active: form.active,
      };
      if (doctor) await sendJson(`/api/doctors/${doctor.id}`, "PATCH", body);
      else await sendJson("/api/doctors", "POST", body);
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
          <DialogTitle>{doctor ? d.editTitle(doctor.name) : d.newTitle}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={d.name} className="sm:col-span-2">
            {(id) => <Input id={id} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder={d.namePlaceholder} maxLength={60} required autoFocus />}
          </Field>
          <Field label={d.specialty}>{(id) => <Input id={id} value={form.specialty} onChange={(e) => set("specialty", e.target.value)} maxLength={80} />}</Field>
          <Field label={d.room}>{(id) => <Input id={id} value={form.room} onChange={(e) => set("room", e.target.value)} maxLength={20} />}</Field>
          <Field label={d.phone}>{(id) => <Input id={id} value={form.phone} onChange={(e) => set("phone", e.target.value)} maxLength={30} inputMode="tel" dir="ltr" />}</Field>
          <Field label={d.licence}>{(id) => <Input id={id} value={form.licence} onChange={(e) => set("licence", e.target.value)} maxLength={40} />}</Field>
          <Field label={d.slot}>{(id) => <Input id={id} value={form.slot} onChange={(e) => set("slot", e.target.value)} inputMode="numeric" dir="ltr" />}</Field>
          {shares && <Field label={d.share} hint={d.shareText}>{(id) => <Input id={id} value={form.share} onChange={(e) => set("share", e.target.value)} inputMode="decimal" dir="ltr" />}</Field>}
          <Field label={d.login} hint={d.loginText} className="sm:col-span-2">
            {(id) => (
              <NativeSelect id={id} value={form.staffId ?? ""} onChange={(e) => set("staffId", e.target.value ? Number(e.target.value) : null)}>
                <option value="">{d.loginNone}</option>
                {logins.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </NativeSelect>
            )}
          </Field>
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-muted/50 px-4 py-3 sm:col-span-2">
            <Label htmlFor="doctor-active">{d.active}</Label>
            <Switch id="doctor-active" checked={form.active} onCheckedChange={(v) => set("active", v)} />
          </div>
          <div className="sm:col-span-2">
            <FormError message={error} />
          </div>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {t.common.cancel}
            </Button>
            <Button type="submit" disabled={busy || !form.name.trim()}>
              {busy ? t.common.saving : t.common.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
