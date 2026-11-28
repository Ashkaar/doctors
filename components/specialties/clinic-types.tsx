"use client";

import { BabyIcon, CheckIcon, EyeIcon, HeartPulseIcon, SmileIcon, StethoscopeIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { errorMessage, sendJson } from "@/lib/clientApi";
import { CLINIC_TYPES, type ClinicType } from "@/lib/specialties";
import { cn } from "@/lib/utils";
import { FormError } from "../form-error";
import { useI18n } from "../i18n-provider";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";

export const TYPE_ICON: Record<ClinicType, React.ComponentType<{ className?: string }>> = {
  general: StethoscopeIcon,
  dental: SmileIcon,
  eye: EyeIcon,
  children: BabyIcon,
  womens: HeartPulseIcon,
};

function TypePicker({ value, onChange }: { value: ClinicType[]; onChange: (v: ClinicType[]) => void }) {
  const { t } = useI18n();
  const toggle = (k: ClinicType) => onChange(value.includes(k) ? value.filter((x) => x !== k) : [...value, k]);
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {CLINIC_TYPES.map((k) => {
        const Icon = TYPE_ICON[k];
        const on = value.includes(k);
        return (
          <button
            key={k}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(k)}
            className={cn("flex cursor-pointer items-start gap-3 rounded-2xl p-3 text-start transition-colors", on ? "bg-primary text-primary-foreground" : "bg-muted/60 hover:bg-highlight")}
          >
            <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", on ? "bg-primary-foreground/20" : "bg-card")}>
              {on ? <CheckIcon className="size-5" /> : <Icon className="size-5" />}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-extrabold">{t.clinicTypes.names[k]}</span>
              <span className={cn("mt-0.5 block text-xs", on ? "opacity-85" : "text-muted-foreground")}>{t.clinicTypes.texts[k]}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

async function save(types: ClinicType[]) {
  await sendJson("/api/settings/clinic", "PUT", { types });
}

// Asked once, the first time the owner opens the clinic.
export function ClinicTypeWelcome() {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [types, setTypes] = useState<ClinicType[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (chosen: ClinicType[]) => {
    setBusy(true);
    setError(null);
    try {
      await save(chosen);
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err, t.common.somethingWrong));
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && submit(types.length ? types : ["general"])}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t.clinicTypes.welcomeTitle}</DialogTitle>
          <DialogDescription>{t.clinicTypes.welcomeText}</DialogDescription>
        </DialogHeader>
        <TypePicker value={types} onChange={setTypes} />
        <FormError message={error} />
        <DialogFooter>
          <Button variant="ghost" onClick={() => submit(["general"])} disabled={busy}>
            {t.clinicTypes.later}
          </Button>
          <Button onClick={() => submit(types)} disabled={busy || types.length === 0}>
            {busy ? t.common.saving : t.common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Settings: change the kind of clinic at any time.
export function ClinicTypeCard({ initial }: { initial: ClinicType[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const [types, setTypes] = useState<ClinicType[]>(initial);
  const [busy, setBusy] = useState(false);
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{t.clinicTypes.title}</CardTitle>
          <CardDescription className="mt-1">{t.clinicTypes.text}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <TypePicker value={types} onChange={setTypes} />
        <Button
          variant="soft"
          disabled={busy || types.length === 0}
          onClick={async () => {
            setBusy(true);
            try {
              await save(types);
              toast.success(t.common.saved);
              router.refresh();
            } catch (err) {
              toast.error(errorMessage(err, t.common.somethingWrong));
            } finally {
              setBusy(false);
            }
          }}
        >
          {t.common.save}
        </Button>
      </CardContent>
    </Card>
  );
}
