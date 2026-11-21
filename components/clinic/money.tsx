"use client";

import { useState } from "react";
import { PAYMENT_METHODS, type Doctor, type PatientSummary, type PaymentMethod, type Service } from "@/lib/clinic";
import { errorMessage, sendJson } from "@/lib/clientApi";
import { FormError } from "../form-error";
import { useI18n } from "../i18n-provider";
import { MoneyInput } from "../money-input";
import { PatientPicker } from "../patients/patient-picker";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { DoctorSelect } from "./booking";
import { Chips, Field, NativeSelect } from "./fields";

function MethodChips({ value, onChange }: { value: PaymentMethod; onChange: (m: PaymentMethod) => void }) {
  const { t } = useI18n();
  return <Chips label={t.payments.method} value={value} onChange={onChange} options={PAYMENT_METHODS.map((m) => ({ value: m, label: t.payments.methods[m] }))} />;
}

// A fee for a patient (a service from the price list, or any amount), and
// what they pay now.
export function FeeDialog({
  open,
  onOpenChange,
  services,
  doctors,
  today,
  showAlerts,
  patient: initialPatient,
  visitId = null,
  doctorId: initialDoctor = null,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  services: Service[];
  doctors: Doctor[];
  today: string;
  showAlerts: boolean;
  patient?: PatientSummary | null;
  visitId?: number | null;
  doctorId?: number | null;
  onSaved: () => void;
}) {
  const { t, money } = useI18n();
  const m = t.payments;
  const [patient, setPatient] = useState<PatientSummary | null>(initialPatient ?? null);
  const [serviceId, setServiceId] = useState<number | null>(services[0]?.id ?? null);
  const service = services.find((s) => s.id === serviceId) ?? null;
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState<number | null>(service?.price ?? 0);
  const [discount, setDiscount] = useState<number | null>(0);
  const [paid, setPaid] = useState<number | null>(service?.price ?? 0);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [doctorId, setDoctorId] = useState<number | null>(initialDoctor ?? (doctors.length === 1 ? doctors[0].id : null));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const price = service ? service.price : (amount ?? 0);
  const due = Math.max(0, price - (discount ?? 0));

  const pick = (id: number | null) => {
    setServiceId(id);
    const s = services.find((x) => x.id === id);
    const p = s ? s.price : (amount ?? 0);
    setPaid(Math.max(0, p - (discount ?? 0)));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patient || amount === null || discount === null || paid === null) return;
    setBusy(true);
    setError(null);
    try {
      await sendJson("/api/charges", "POST", {
        patientId: patient.id,
        visitId,
        doctorId,
        serviceId,
        description: service ? service.name : description,
        amount: price,
        discount,
        paid: Math.min(paid, due),
        method,
      });
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err, t.common.somethingWrong));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t.common.close}>
        <DialogHeader>
          <DialogTitle>{m.feeTitle}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {initialPatient ? (
            <p className="rounded-2xl bg-primary-soft px-4 py-3 font-bold text-primary-soft-foreground">{initialPatient.name}</p>
          ) : (
            <PatientPicker value={patient} onChange={setPatient} today={today} showAlerts={showAlerts} />
          )}
          <Field label={m.service} hint={services.length === 0 ? m.noServices : undefined}>
            {(id) => (
              <NativeSelect id={id} value={serviceId ?? ""} onChange={(e) => pick(e.target.value ? Number(e.target.value) : null)}>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {money(s.price)}
                  </option>
                ))}
                <option value="">{m.otherService}</option>
              </NativeSelect>
            )}
          </Field>
          {!service && (
            <div className="grid grid-cols-2 gap-3">
              <Field label={m.description}>
                {(id) => <Input id={id} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={m.visitFee} maxLength={120} />}
              </Field>
              <Field label={m.amount}>
                {(id) => (
                  <MoneyInput
                    id={id}
                    cents={amount ?? 0}
                    onChange={(c) => {
                      setAmount(c);
                      if (c !== null) setPaid(Math.max(0, c - (discount ?? 0)));
                    }}
                  />
                )}
              </Field>
            </div>
          )}
          {doctors.length > 1 && <Field label={t.doctors.pick}>{(id) => <DoctorSelect id={id} doctors={doctors} value={doctorId} onChange={setDoctorId} />}</Field>}
          <div className="grid grid-cols-2 gap-3">
            <Field label={m.discount}>
              {(id) => (
                <MoneyInput
                  id={id}
                  cents={discount ?? 0}
                  onChange={(c) => {
                    setDiscount(c);
                    if (c !== null) setPaid(Math.max(0, price - c));
                  }}
                />
              )}
            </Field>
            <Field label={m.paidNow}>{(id) => <MoneyInput id={id} cents={paid ?? 0} onChange={setPaid} />}</Field>
          </div>
          <div className="flex items-center justify-between rounded-2xl bg-muted/60 px-4 py-3">
            <span className="text-sm font-semibold text-muted-foreground">{m.toPay}</span>
            <span className="tabular text-xl font-extrabold">{money(due)}</span>
          </div>
          {(paid ?? 0) > 0 && <MethodChips value={method} onChange={setMethod} />}
          <FormError message={error} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t.common.cancel}
            </Button>
            <Button type="submit" disabled={busy || !patient || amount === null || discount === null || paid === null || (discount ?? 0) > price}>
              {busy ? t.common.saving : t.common.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Money received against what the patient owes.
export function PaymentDialog({
  open,
  onOpenChange,
  patient,
  balance,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: PatientSummary;
  balance: number;
  onSaved: () => void;
}) {
  const { t, money } = useI18n();
  const m = t.payments;
  const [amount, setAmount] = useState<number | null>(balance > 0 ? balance : 0);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount) return;
    setBusy(true);
    setError(null);
    try {
      await sendJson("/api/payments", "POST", { patientId: patient.id, amount, method });
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err, t.common.somethingWrong));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t.common.close}>
        <DialogHeader>
          <DialogTitle>{m.paymentTitle}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="flex items-center justify-between rounded-2xl bg-primary-soft px-4 py-3">
            <span className="font-bold text-primary-soft-foreground">{patient.name}</span>
            <span className="tabular text-sm font-bold">{balance > 0 ? m.balanceOwed(money(balance)) : m.balanceClear}</span>
          </div>
          <Field label={m.amount}>{(id) => <MoneyInput id={id} cents={amount ?? 0} onChange={setAmount} autoFocus />}</Field>
          <MethodChips value={method} onChange={setMethod} />
          <FormError message={error} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t.common.cancel}
            </Button>
            <Button type="submit" disabled={busy || !amount}>
              {busy ? t.common.saving : t.common.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
