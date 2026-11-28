"use client";

import { CalendarDaysIcon, CalendarPlusIcon, ChevronLeftIcon, ChevronRightIcon, EllipsisVerticalIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { HoursSettings } from "@/lib/clinicSettings";
import { hoursOn, minutesToTime, type Appointment, type AppointmentStatus, type Doctor, type QueueTicket } from "@/lib/clinic";
import { errorMessage, getJson, sendJson } from "@/lib/clientApi";
import { addDays, weekdayOf } from "@/lib/format";
import { cn } from "@/lib/utils";
import { BookDialog } from "../clinic/booking";
import { Empty } from "../clinic/fields";
import { useI18n } from "../i18n-provider";
import { PageBody, PageHeader } from "../page-header";
import { useShop } from "../shop-provider";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { Input } from "../ui/input";

const STATUS_BADGE: Record<AppointmentStatus, "default" | "neutral" | "accent" | "destructive"> = {
  booked: "neutral",
  arrived: "default",
  done: "neutral",
  cancelled: "destructive",
  noShow: "accent",
};

export function AppointmentsScreen({
  today,
  doctors,
  initial,
  hours,
  showAlerts,
  canQueue,
  isOwner,
}: {
  today: string;
  doctors: Doctor[];
  initial: Appointment[];
  hours: HoursSettings;
  showAlerts: boolean;
  canQueue: boolean;
  isOwner: boolean;
}) {
  const { t, day: dayText, dir } = useI18n();
  const a = t.appointments;
  const shop = useShop();
  const [day, setDay] = useState(today);
  const [doctorId, setDoctorId] = useState<number | null>(doctors.length === 1 ? doctors[0].id : null);
  const [list, setList] = useState(initial);
  const [booking, setBooking] = useState<{ startMin?: number; appointment?: Appointment } | null>(null);

  const load = useCallback(async (d: string) => {
    try {
      const res = await getJson<{ appointments: Appointment[] }>(`/api/appointments?day=${d}`);
      setList(res.appointments);
    } catch (err) {
      toast.error(errorMessage(err, t.common.somethingWrong));
    }
  }, [t.common.somethingWrong]);

  useEffect(() => {
    if (day === today) return;
    const id = setTimeout(() => void load(day), 0);
    return () => clearTimeout(id);
  }, [day, today, load]);

  const go = (d: string) => {
    setDay(d);
    if (d === today) void load(d);
  };

  const setStatus = async (appt: Appointment, status: AppointmentStatus) => {
    try {
      const res = await sendJson<{ appointment: Appointment; ticket?: QueueTicket }>(`/api/appointments/${appt.id}`, "PATCH", { status });
      if (res.ticket) toast.success(a.arrivedDone(res.ticket.number));
      await load(day);
    } catch (err) {
      toast.error(errorMessage(err, t.common.somethingWrong));
    }
  };

  const shown = list.filter((x) => doctorId === null || x.doctorId === doctorId);
  const doctorName = (id: number) => doctors.find((d) => d.id === id)?.name ?? "";
  const live = shown.filter((x) => x.status !== "cancelled");

  // Free slots for the chosen doctor (when one is chosen), between bookings.
  const doctor = doctors.find((d) => d.id === doctorId);
  const doctorHours = doctor ? hoursOn(doctor.schedule, day, weekdayOf(day), hours) : null;
  const slots: number[] = [];
  if (doctor && doctorHours && "startMin" in doctorHours && day >= today) {
    for (let m = doctorHours.startMin; m + doctor.slotMinutes <= doctorHours.endMin; m += doctor.slotMinutes) {
      const busy = live.some((x) => x.status !== "noShow" && x.startMin < m + doctor.slotMinutes && x.startMin + x.durationMin > m);
      if (!busy) slots.push(m);
    }
  }

  const Prev = dir === "rtl" ? ChevronRightIcon : ChevronLeftIcon;
  const Next = dir === "rtl" ? ChevronLeftIcon : ChevronRightIcon;

  if (doctors.length === 0) {
    return (
      <PageBody>
        <PageHeader title={a.title} />
        <Empty icon={CalendarDaysIcon} text={t.doctors.needOne}>
          {isOwner && (
            <Button asChild variant="soft">
              <Link href={shop.href("/dashboard/doctors")}>{t.doctors.add}</Link>
            </Button>
          )}
        </Empty>
      </PageBody>
    );
  }

  return (
    <PageBody>
      <PageHeader title={a.title} description={`${t.weekdays[weekdayOf(day)]} ${dayText(day)} · ${a.count(live.length)}`}>
        <Button onClick={() => setBooking({})}>
          <CalendarPlusIcon />
          {a.book}
        </Button>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-full bg-card p-1 shadow-soft">
          <Button variant="ghost" size="icon-sm" aria-label={t.common.previous} onClick={() => go(addDays(day, -1))}>
            <Prev />
          </Button>
          <Button variant={day === today ? "soft" : "ghost"} size="sm" onClick={() => go(today)}>
            {t.common.today}
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label={t.common.next} onClick={() => go(addDays(day, 1))}>
            <Next />
          </Button>
        </div>
        <Input type="date" value={day} onChange={(e) => e.target.value && go(e.target.value)} className="h-10 w-auto rounded-full" aria-label={a.day} />
        {doctors.length > 1 && (
          <div className="flex min-w-0 max-w-full gap-2 overflow-x-auto">
            {[{ id: null as number | null, name: t.doctors.allDoctors }, ...doctors].map((d) => (
              <button
                key={d.id ?? "all"}
                type="button"
                onClick={() => setDoctorId(d.id)}
                className={cn("h-9 shrink-0 cursor-pointer rounded-full px-4 text-sm font-bold", doctorId === d.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground")}
              >
                {d.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-2 lg:col-span-2">
          {shown.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">{a.none}</p>
          ) : (
            <ul className="space-y-1">
              {shown.map((x) => (
                <li key={x.id} className={cn("flex items-center gap-3 rounded-2xl px-3 py-3", x.status === "arrived" && "bg-primary-soft", x.status === "cancelled" && "opacity-60")}>
                  <span className="w-14 shrink-0 text-center" dir="ltr">
                    <span className="tabular block text-base font-extrabold text-primary">{minutesToTime(x.startMin)}</span>
                    <span className="tabular block text-[11px] text-muted-foreground">{x.durationMin}′</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <Link href={shop.href(`/dashboard/patients/${x.patientId}`)} className="block truncate font-bold hover:underline">
                      {x.patientName}
                    </Link>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[doctors.length > 1 ? doctorName(x.doctorId) : "", x.reason, x.phone ? `☎ ${x.phone}` : ""].filter(Boolean).join(" · ") || t.patients.fileNo(x.fileNo)}
                    </span>
                  </span>
                  <Badge variant={STATUS_BADGE[x.status]} className="hidden sm:inline-flex">
                    {a.statuses[x.status]}
                  </Badge>
                  {x.status === "booked" && canQueue && day === today && (
                    <Button size="sm" onClick={() => setStatus(x, "arrived")}>
                      {a.arrived}
                    </Button>
                  )}
                  <DropdownMenu dir={dir}>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label={t.common.edit}>
                        <EllipsisVerticalIcon />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setBooking({ appointment: x })}>{t.common.edit}</DropdownMenuItem>
                      {x.status !== "booked" && <DropdownMenuItem onSelect={() => setStatus(x, "booked")}>{a.statuses.booked}</DropdownMenuItem>}
                      {x.status !== "done" && <DropdownMenuItem onSelect={() => setStatus(x, "done")}>{a.statuses.done}</DropdownMenuItem>}
                      {x.status !== "noShow" && <DropdownMenuItem onSelect={() => setStatus(x, "noShow")}>{a.noShow}</DropdownMenuItem>}
                      {x.status !== "cancelled" && (
                        <DropdownMenuItem variant="destructive" onSelect={() => setStatus(x, "cancelled")}>
                          {a.cancel}
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              ))}
            </ul>
          )}
        </Card>
        {doctor && doctorHours && "off" in doctorHours && (
          <Card className="h-fit bg-accent-50 p-4 text-sm font-semibold text-accent-900 dark:bg-accent-500/10 dark:text-accent-200">
            {doctorHours.off === "off" ? a.doctorOff(doctor.name, doctorHours.note) : a.doctorClosed(doctor.name)}
          </Card>
        )}
        {doctor && slots.length > 0 && (
          <Card className="h-fit p-4">
            <p className="mb-3 text-sm font-extrabold">
              {a.free} · {doctor.name}
            </p>
            <div className="grid grid-cols-4 gap-2" dir="ltr">
              {slots.slice(0, 48).map((m) => (
                <button key={m} type="button" onClick={() => setBooking({ startMin: m })} className="tabular h-9 cursor-pointer rounded-full bg-muted text-sm font-bold hover:bg-primary hover:text-primary-foreground">
                  {minutesToTime(m)}
                </button>
              ))}
            </div>
          </Card>
        )}
      </div>

      {booking && (
        <BookDialog
          open
          onOpenChange={(o) => !o && setBooking(null)}
          doctors={doctors}
          today={today}
          showAlerts={showAlerts}
          hours={hours}
          day={day}
          doctorId={doctorId}
          startMin={booking.startMin}
          appointment={booking.appointment}
          onSaved={(saved) => {
            toast.success(t.common.saved);
            if (saved.day === day) void load(day);
            else go(saved.day);
          }}
        />
      )}
    </PageBody>
  );
}
