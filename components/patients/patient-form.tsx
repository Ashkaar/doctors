"use client";

import { useState } from "react";
import { ageOn, BLOOD_GROUPS, GENDERS, type Gender, type Patient } from "@/lib/clinic";
import { errorMessage, sendJson } from "@/lib/clientApi";
import { toLatinDigits } from "@/lib/format";
import { Field, NativeSelect } from "../clinic/fields";
import { FormError } from "../form-error";
import { useI18n } from "../i18n-provider";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";

// New patient, or a patient's details. Allergies and conditions are shown
// (and sent) only when this login may see medical alerts.
export function PatientDialog({
  open,
  onOpenChange,
  patient,
  showAlerts,
  today,
  initialName = "",
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient?: Patient | null;
  showAlerts: boolean;
  today: string;
  initialName?: string;
  onSaved: (patient: Patient) => void;
}) {
  const { t } = useI18n();
  const p = t.patients;
  const [name, setName] = useState(patient?.name ?? initialName);
  const [phone, setPhone] = useState(patient?.phone ?? "");
  const [gender, setGender] = useState<Gender>(patient?.gender ?? "");
  const [birthDate, setBirthDate] = useState(patient?.birthDate ?? "");
  const [age, setAge] = useState(() => {
    const a = patient?.birthDate ? ageOn(patient.birthDate, today) : null;
    return patient?.birthDate && /^\d{4}$/.test(patient.birthDate) && a !== null ? String(a) : "";
  });
  const [bloodGroup, setBloodGroup] = useState(patient?.bloodGroup ?? "");
  const [address, setAddress] = useState(patient?.address ?? "");
  const [notes, setNotes] = useState(patient?.notes ?? "");
  const [allergies, setAllergies] = useState(patient?.allergies ?? "");
  const [conditions, setConditions] = useState(patient?.conditions ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Typing an age keeps only the year of birth.
  const onAge = (value: string) => {
    const digits = toLatinDigits(value).replace(/\D/g, "").slice(0, 3);
    setAge(digits);
    if (digits) setBirthDate(String(Number(today.slice(0, 4)) - Number(digits)));
    else if (/^\d{4}$/.test(birthDate)) setBirthDate("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = {
        name,
        phone: toLatinDigits(phone),
        gender,
        birthDate,
        bloodGroup,
        address,
        notes,
        ...(showAlerts ? { allergies, conditions } : {}),
      };
      const res = patient
        ? await sendJson<{ patient: Patient }>(`/api/patients/${patient.id}`, "PATCH", body)
        : await sendJson<{ patient: Patient }>("/api/patients", "POST", body);
      onSaved(res.patient);
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err, t.common.somethingWrong));
    } finally {
      setBusy(false);
    }
  };

  const fullDate = /^\d{4}-\d{2}-\d{2}$/.test(birthDate) ? birthDate : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t.common.close} className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{patient ? p.editTitle : p.newTitle}</DialogTitle>
          {patient && <DialogDescription>{p.fileNo(patient.fileNo)}</DialogDescription>}
        </DialogHeader>
        <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={p.name} className="sm:col-span-2">
            {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required autoFocus autoComplete="off" />}
          </Field>
          <Field label={p.phone}>
            {(id) => <Input id={id} value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} inputMode="tel" dir="ltr" autoComplete="off" />}
          </Field>
          <Field label={p.gender}>
            {(id) => (
              <NativeSelect id={id} value={gender} onChange={(e) => setGender(e.target.value as Gender)}>
                {GENDERS.map((g) => (
                  <option key={g} value={g}>
                    {p.genders[g]}
                  </option>
                ))}
              </NativeSelect>
            )}
          </Field>
          <div className="grid grid-cols-[1fr_6rem] gap-3">
            <Field label={p.birth}>
              {(id) => (
                <Input
                  id={id}
                  type="date"
                  value={fullDate}
                  max={today}
                  onChange={(e) => {
                    setBirthDate(e.target.value);
                    setAge("");
                  }}
                />
              )}
            </Field>
            <Field label={p.ageInstead}>
              {(id) => <Input id={id} value={age} onChange={(e) => onAge(e.target.value)} inputMode="numeric" dir="ltr" />}
            </Field>
          </div>
          <Field label={p.bloodGroup}>
            {(id) => (
              <NativeSelect id={id} value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)} dir="ltr">
                {BLOOD_GROUPS.map((g) => (
                  <option key={g} value={g}>
                    {g || "—"}
                  </option>
                ))}
              </NativeSelect>
            )}
          </Field>
          {showAlerts && (
            <>
              <Field label={p.allergies}>
                {(id) => <Textarea id={id} value={allergies} onChange={(e) => setAllergies(e.target.value)} maxLength={500} className="min-h-16" />}
              </Field>
              <Field label={p.conditions}>
                {(id) => <Textarea id={id} value={conditions} onChange={(e) => setConditions(e.target.value)} maxLength={500} className="min-h-16" />}
              </Field>
            </>
          )}
          <Field label={p.address} className="sm:col-span-2">
            {(id) => <Input id={id} value={address} onChange={(e) => setAddress(e.target.value)} maxLength={200} autoComplete="off" />}
          </Field>
          <Field label={p.notes} className="sm:col-span-2">
            {(id) => <Textarea id={id} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} className="min-h-16" />}
          </Field>
          <div className="sm:col-span-2">
            <FormError message={error} />
          </div>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t.common.cancel}
            </Button>
            <Button type="submit" disabled={busy || !name.trim()}>
              {busy ? t.common.saving : t.common.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
