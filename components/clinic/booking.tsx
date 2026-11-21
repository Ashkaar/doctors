"use client";

import { useState } from "react";
import { minutesToTime, timeToMinutes, type Appointment, type Doctor, type PatientSummary, type QueueTicket } from "@/lib/clinic";
import { errorMessage, sendJson } from "@/lib/clientApi";
import { FormError } from "../form-error";
import { useI18n } from "../i18n-provider";
import { PatientPicker } from "../patients/patient-picker";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Field, NativeSelect } from "./fields";

export function DoctorSelect({ doctors, value, onChange, id }: { doctors: Doctor[]; value: number | null; onChange: (id: number) => void; id?: string }) {
  const { t } = useI18n();
  return (
    <NativeSelect id={id} value={value ?? ""} onChange={(e) => onChange(Number(e.target.value))} required>
      {value === null && <option value="">{t.doctors.pick}</option>}
      {doctors.map((d) => (
        <option key={d.id} value={d.id}>
          {d.name}
          {d.specialty ? ` · ${d.specialty}` : ""}
        </option>
      ))}
    </NativeSelect>
  );
}

// Book an appointment, or move one (`appointment`).
export function BookDialog({
  open,
  onOpenChange,
  doctors,
  today,
  showAlerts,
  day: initialDay,
  doctorId: initialDoctor,
  startMin: initialStart,
  patient: initialPatient,
  appointment,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doctors: Doctor[];
  today: string;
  showAlerts: boolean;
  day?: string;
  doctorId?: number | null;
  startMin?: number;
  patient?: PatientSummary | null;
  appointment?: Appointment | null;
  onSaved: (a: Appointment) => void;
}) {
  const { t } = useI18n();
  const a = t.appointments;
  const [patient, setPatient] = useState<PatientSummary | null>(
    appointment ? { id: appointment.patientId, fileNo: appointment.fileNo, name: appointment.patientName, phone: appointment.phone, gender: "", birthDate: "", lastVisitAt: null } : (initialPatient ?? null),
  );
  const [doctorId, setDoctorId] = useState<number | null>(appointment?.doctorId ?? initialDoctor ?? (doctors.length === 1 ? doctors[0].id : null));
  const doctor = doctors.find((d) => d.id === doctorId);
  const [day, setDay] = useState(appointment?.day ?? initialDay ?? today);
  const [time, setTime] = useState(minutesToTime(appointment?.startMin ?? initialStart ?? 9 * 60));
  const [duration, setDuration] = useState(String(appointment?.durationMin ?? doctor?.slotMinutes ?? 15));
  const [reason, setReason] = useState(appointment?.reason ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const startMin = timeToMinutes(time);
    if (!patient || !doctorId || startMin === null) return;
    setBusy(true);
    setError(null);
    try {
      const body = { patientId: patient.id, doctorId, day, startMin, durationMin: Number(duration) || 15, reason };
      const res = appointment
        ? await sendJson<{ appointment: Appointment }>(`/api/appointments/${appointment.id}`, "PATCH", body)
        : await sendJson<{ appointment: Appointment }>("/api/appointments", "POST", body);
      onSaved(res.appointment);
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
          <DialogTitle>{appointment ? a.editTitle : a.newTitle}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {appointment ? (
            <p className="rounded-2xl bg-primary-soft px-4 py-3 font-bold text-primary-soft-foreground">{appointment.patientName}</p>
          ) : (
            <PatientPicker value={patient} onChange={setPatient} today={today} showAlerts={showAlerts} />
          )}
          <Field label={t.doctors.pick}>
            {(id) => (
              <DoctorSelect
                id={id}
                doctors={doctors}
                value={doctorId}
                onChange={(v) => {
                  setDoctorId(v);
                  const d = doctors.find((x) => x.id === v);
                  if (d && !appointment) setDuration(String(d.slotMinutes));
                }}
              />
            )}
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label={a.day} className="col-span-3 sm:col-span-1">
              {(id) => <Input id={id} type="date" value={day} min={appointment ? undefined : today} onChange={(e) => setDay(e.target.value)} required />}
            </Field>
            <Field label={a.time} className="col-span-3 sm:col-span-1">
              {(id) => <Input id={id} type="time" value={time} step={300} onChange={(e) => setTime(e.target.value)} required dir="ltr" />}
            </Field>
            <Field label={a.duration} className="col-span-3 sm:col-span-1">
              {(id) => <Input id={id} type="number" min={5} max={480} step={5} value={duration} onChange={(e) => setDuration(e.target.value)} dir="ltr" />}
            </Field>
          </div>
          <Field label={a.reason}>
            {(id) => <Input id={id} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={a.reasonPlaceholder} maxLength={200} />}
          </Field>
          <FormError message={error} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t.common.cancel}
            </Button>
            <Button type="submit" disabled={busy || !patient || !doctorId}>
              {busy ? t.common.saving : appointment ? t.common.save : a.book}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// A walk-in: gets the day's next turn number for a doctor.
export function WalkInDialog({
  open,
  onOpenChange,
  doctors,
  today,
  showAlerts,
  doctorId: initialDoctor,
  patient: initialPatient,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doctors: Doctor[];
  today: string;
  showAlerts: boolean;
  doctorId?: number | null;
  patient?: PatientSummary | null;
  onSaved: (ticket: QueueTicket) => void;
}) {
  const { t } = useI18n();
  const [patient, setPatient] = useState<PatientSummary | null>(initialPatient ?? null);
  const [doctorId, setDoctorId] = useState<number | null>(initialDoctor ?? (doctors.length === 1 ? doctors[0].id : null));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patient || !doctorId) return;
    setBusy(true);
    setError(null);
    try {
      const { ticket } = await sendJson<{ ticket: QueueTicket }>("/api/queue", "POST", { patientId: patient.id, doctorId });
      onSaved(ticket);
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
          <DialogTitle>{t.queue.walkInTitle}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {initialPatient ? (
            <p className="rounded-2xl bg-primary-soft px-4 py-3 font-bold text-primary-soft-foreground">{initialPatient.name}</p>
          ) : (
            <PatientPicker value={patient} onChange={setPatient} today={today} showAlerts={showAlerts} />
          )}
          <Field label={t.doctors.pick}>{(id) => <DoctorSelect id={id} doctors={doctors} value={doctorId} onChange={setDoctorId} />}</Field>
          <FormError message={error} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t.common.cancel}
            </Button>
            <Button type="submit" disabled={busy || !patient || !doctorId}>
              {busy ? t.common.saving : t.patients.toQueue}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
