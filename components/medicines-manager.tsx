"use client";

import { PencilIcon, PillIcon, PlusIcon, SearchIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Medicine } from "@/lib/clinic";
import { errorMessage, sendJson } from "@/lib/clientApi";
import { Empty, Field } from "./clinic/fields";
import { ConfirmDialog } from "./confirm-dialog";
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

export function MedicinesManager({ initial }: { initial: Medicine[] }) {
  const { t } = useI18n();
  const m = t.medicines;
  const router = useRouter();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Medicine | "new" | null>(null);
  const [remove, setRemove] = useState<Medicine | null>(null);
  const shown = initial.filter((x) => !q.trim() || x.name.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <PageBody>
      <PageHeader title={m.title} description={m.intro}>
        <Button onClick={() => setEditing("new")}>
          <PlusIcon />
          {m.add}
        </Button>
      </PageHeader>
      {initial.length > 8 && (
        <div className="relative max-w-md">
          <SearchIcon className="pointer-events-none absolute start-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.common.search} aria-label={t.common.search} className="rounded-full ps-10" />
        </div>
      )}
      {initial.length === 0 ? (
        <Empty icon={PillIcon} text={m.none} />
      ) : (
        <Card className="p-2">
          <ul className="space-y-1">
            {shown.map((x) => (
              <li key={x.id} className="flex items-center gap-3 rounded-2xl px-3 py-2.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-soft-foreground">
                  <PillIcon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{x.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{[x.form, x.dose, x.frequency, x.duration].filter(Boolean).join(" · ") || "—"}</span>
                </span>
                {!x.active && <Badge variant="neutral">{t.common.none}</Badge>}
                <Button variant="ghost" size="icon-sm" aria-label={m.editTitle(x.name)} onClick={() => setEditing(x)}>
                  <PencilIcon />
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label={t.common.delete} onClick={() => setRemove(x)}>
                  <Trash2Icon />
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {editing && <MedicineDialog medicine={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); router.refresh(); }} />}
      <ConfirmDialog
        open={remove !== null}
        onOpenChange={(o) => !o && setRemove(null)}
        title={remove ? m.deleteTitle(remove.name) : ""}
        description={m.deleteText}
        confirmLabel={t.common.delete}
        destructive
        onConfirm={async () => {
          await sendJson(`/api/medicines/${remove!.id}`, "DELETE");
          setRemove(null);
          router.refresh();
        }}
      />
    </PageBody>
  );
}

function MedicineDialog({ medicine, onClose, onSaved }: { medicine: Medicine | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useI18n();
  const m = t.medicines;
  const [form, setForm] = useState({
    name: medicine?.name ?? "",
    form: medicine?.form ?? "",
    dose: medicine?.dose ?? "",
    frequency: medicine?.frequency ?? "",
    duration: medicine?.duration ?? "",
    active: medicine?.active ?? true,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (medicine) await sendJson(`/api/medicines/${medicine.id}`, "PATCH", form);
      else await sendJson("/api/medicines", "POST", form);
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
          <DialogTitle>{medicine ? m.editTitle(medicine.name) : m.newTitle}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={m.name} className="sm:col-span-2">
            {(id) => <Input id={id} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder={m.namePlaceholder} maxLength={120} required autoFocus />}
          </Field>
          <Field label={m.form}>{(id) => <Input id={id} value={form.form} onChange={(e) => set("form", e.target.value)} placeholder={m.formPlaceholder} maxLength={40} />}</Field>
          <Field label={m.dose}>{(id) => <Input id={id} value={form.dose} onChange={(e) => set("dose", e.target.value)} maxLength={60} />}</Field>
          <Field label={m.frequency}>{(id) => <Input id={id} value={form.frequency} onChange={(e) => set("frequency", e.target.value)} maxLength={60} />}</Field>
          <Field label={m.duration}>{(id) => <Input id={id} value={form.duration} onChange={(e) => set("duration", e.target.value)} maxLength={60} />}</Field>
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-muted/50 px-4 py-3 sm:col-span-2">
            <Label htmlFor="medicine-active">{m.active}</Label>
            <Switch id="medicine-active" checked={form.active} onCheckedChange={(v) => set("active", v)} />
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
