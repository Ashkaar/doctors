"use client";

import { CameraIcon, CheckCircle2Icon, FileIcon, FlaskConicalIcon, PaperclipIcon, ScanIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { FILE_KINDS, MAX_FILE_BYTES, ORDER_KINDS, type FileKind, type Order, type OrderKind, type PatientFile } from "@/lib/clinic";
import { ApiError, errorMessage, sendFile, sendJson } from "@/lib/clientApi";
import { cn } from "@/lib/utils";
import { Chips, Field, NativeSelect } from "../clinic/fields";
import { ConfirmDialog } from "../confirm-dialog";
import { useI18n } from "../i18n-provider";
import { useShop } from "../shop-provider";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";

const MAX_SIDE = 2200;

// A photo of a lab sheet or an X-ray, made smaller in the browser (a phone
// photo is often 5–10 MB): at most 2200 px on its long side, as JPEG.
async function shrink(file: File): Promise<Blob> {
  if (file.type === "application/pdf") return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  for (const quality of [0.85, 0.7, 0.55]) {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (blob && blob.size <= MAX_FILE_BYTES) return blob;
  }
  throw new Error("too big");
}

export function FilesPanel({ patientId, visitId = null, files, orders }: { patientId: number; visitId?: number | null; files: PatientFile[]; orders: Order[] }) {
  const { t, date } = useI18n();
  const f = t.files;
  const shop = useShop();
  const router = useRouter();
  const picker = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<FileKind>("lab");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [remove, setRemove] = useState<number | null>(null);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      if (file.type !== "application/pdf" && !file.type.startsWith("image/")) throw new Error(t.errors.fileType);
      const blob = await shrink(file);
      if (blob.size > MAX_FILE_BYTES) throw new Error("too big");
      const q = new URLSearchParams({ kind, title });
      if (visitId) q.set("visit", String(visitId));
      await sendFile(`/api/patients/${patientId}/files?${q}`, blob, "POST");
      setTitle("");
      toast.success(t.common.saved);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) toast.error(errorMessage(err, t.common.somethingWrong));
      else if (err instanceof Error && err.message === "too big") toast.error(t.errors.fileTooBig);
      else if (err instanceof Error && err.message === t.errors.fileType) toast.error(t.errors.fileType);
      else toast.error(t.common.somethingWrong);
    } finally {
      setBusy(false);
      if (picker.current) picker.current.value = "";
      if (camera.current) camera.current.value = "";
    }
  };

  return (
    <div className="space-y-4">
      <OrdersCard patientId={patientId} visitId={visitId} orders={orders} />
      <Card>
        <CardHeader>
          <CardTitle>{t.patients.tabs.files}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3 rounded-2xl bg-muted/40 p-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={f.kind}>
                {(id) => (
                  <NativeSelect id={id} value={kind} onChange={(e) => setKind(e.target.value as FileKind)}>
                    {FILE_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {f.kinds[k]}
                      </option>
                    ))}
                  </NativeSelect>
                )}
              </Field>
              <Field label={f.title}>{(id) => <Input id={id} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={f.titlePlaceholder} maxLength={120} />}</Field>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => picker.current?.click()} disabled={busy}>
                <PaperclipIcon />
                {busy ? f.uploading : f.choose}
              </Button>
              <Button type="button" variant="outline" onClick={() => camera.current?.click()} disabled={busy}>
                <CameraIcon />
                {f.camera}
              </Button>
              <input ref={picker} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
              <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
            </div>
          </div>
          {files.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{f.none}</p>
          ) : (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {files.map((file) => (
                <li key={file.id} className="flex items-center gap-3 rounded-2xl bg-muted/40 p-2">
                  <a href={shop.href(`/api/files/${file.id}`)} target="_blank" rel="noreferrer" className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-card">
                    {file.mime.startsWith("image/") ? (
                      // eslint-disable-next-line @next/next/no-img-element -- private file, served by our own API, never optimised by a CDN
                      <img src={shop.href(`/api/files/${file.id}`)} alt="" loading="lazy" className="size-full object-cover" />
                    ) : (
                      <FileIcon className="size-6 text-muted-foreground" />
                    )}
                  </a>
                  <div className="min-w-0 flex-1">
                    <a href={shop.href(`/api/files/${file.id}`)} target="_blank" rel="noreferrer" className="block truncate text-sm font-bold hover:underline">
                      {file.title || f.kinds[file.kind]}
                    </a>
                    <p className="truncate text-xs text-muted-foreground">
                      {f.kinds[file.kind]} · {date(file.createdAt)} · {f.size(Math.max(1, Math.round(file.size / 1024)))}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon-sm" aria-label={t.common.delete} onClick={() => setRemove(file.id)}>
                    <Trash2Icon />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <ConfirmDialog
        open={remove !== null}
        onOpenChange={(o) => !o && setRemove(null)}
        title={f.deleteTitle}
        confirmLabel={t.common.delete}
        destructive
        onConfirm={async () => {
          await sendJson(`/api/files/${remove}`, "DELETE");
          setRemove(null);
          router.refresh();
        }}
      />
    </div>
  );
}

// Lab tests and imaging asked for, and their results.
export function OrdersCard({ patientId, visitId, orders }: { patientId: number; visitId: number | null; orders: Order[] }) {
  const { t, date } = useI18n();
  const v = t.visits;
  const router = useRouter();
  const [kind, setKind] = useState<OrderKind>("lab");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [result, setResult] = useState("");

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await sendJson("/api/orders", "POST", { patientId, visitId, kind, name });
      setName("");
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err, t.common.somethingWrong));
    } finally {
      setBusy(false);
    }
  };

  const saveResult = async (order: Order) => {
    try {
      await sendJson(`/api/orders/${order.id}`, "PATCH", { status: "done", result });
      setEditing(null);
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err, t.common.somethingWrong));
    }
  };

  const removeOrder = async (order: Order) => {
    try {
      await sendJson(`/api/orders/${order.id}`, "DELETE");
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err, t.common.somethingWrong));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{v.orders}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <form onSubmit={add} className="flex flex-wrap items-center gap-2">
          <Chips label={v.orders} value={kind} onChange={setKind} options={ORDER_KINDS.map((k) => ({ value: k, label: v.orderKinds[k] }))} />
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={v.orderNamePlaceholder} aria-label={v.orderName} maxLength={120} className="min-w-40 flex-1" />
          <Button type="submit" variant="soft" disabled={busy || !name.trim()}>
            {v.orderAdd}
          </Button>
        </form>
        {orders.length > 0 && (
          <ul className="space-y-2">
            {orders.map((o) => (
              <li key={o.id} className={cn("rounded-2xl p-3", o.status === "done" ? "bg-muted/40" : "bg-accent-50 dark:bg-accent-500/10")}>
                <div className="flex items-center gap-3">
                  {o.kind === "lab" ? <FlaskConicalIcon className="size-4 shrink-0 text-muted-foreground" /> : <ScanIcon className="size-4 shrink-0 text-muted-foreground" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{o.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {v.orderKinds[o.kind]} · {date(o.createdAt)}
                    </p>
                  </div>
                  <Badge variant={o.status === "done" ? "default" : "accent"}>
                    {o.status === "done" && <CheckCircle2Icon className="size-3" />}
                    {v.orderStatus[o.status]}
                  </Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditing(o.id);
                      setResult(o.result);
                    }}
                  >
                    {v.orderResult}
                  </Button>
                  <Button variant="ghost" size="icon-sm" aria-label={t.common.delete} onClick={() => removeOrder(o)}>
                    <Trash2Icon />
                  </Button>
                </div>
                {editing === o.id ? (
                  <div className="mt-2 space-y-2">
                    <Textarea value={result} onChange={(e) => setResult(e.target.value)} maxLength={2000} aria-label={v.orderResult} />
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => setEditing(null)}>
                        {t.common.cancel}
                      </Button>
                      <Button size="sm" onClick={() => saveResult(o)}>
                        {v.orderSaveResult}
                      </Button>
                    </div>
                  </div>
                ) : (
                  o.result && <p className="mt-2 whitespace-pre-line text-sm">{o.result}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
