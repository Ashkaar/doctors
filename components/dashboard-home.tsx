"use client";

import { ArrowUpRightIcon, CalendarDaysIcon, CheckCircle2Icon, CircleIcon, CreditCardIcon, ListOrderedIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { minutesToTime, type Appointment, type Doctor, type QueueTicket } from "@/lib/clinic";
import { clockIn, weekdayOf } from "@/lib/format";
import type { Viewer } from "@/lib/sections";
import { GRACE_MS, type PlanId, type ShopState } from "@/lib/shopState";
import { cn } from "@/lib/utils";
import { TurnNumber } from "./clinic/fields";
import { useI18n } from "./i18n-provider";
import { PageBody } from "./page-header";
import { useShop } from "./shop-provider";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

export interface Subscription {
  state: ShopState;
  plan: PlanId | null;
  trialEndsAt: number | null;
  paidUntil: number | null;
  accountUrl: string;
}

// "Today": the day at a glance, in the warm calm design. The first figure
// (waiting) is filled with the clinic's colour.
export function DashboardHome({
  viewer,
  subscription,
  day,
  doctors,
  appointments,
  queue,
  feesToday,
  setup,
}: {
  viewer: Viewer;
  subscription: Subscription | null;
  day: string;
  doctors: Doctor[];
  appointments: Appointment[];
  queue: QueueTicket[];
  feesToday: number | null;
  setup: { doctors: boolean; services: boolean; patients: boolean } | null;
}) {
  const { t, date, money, day: dayText } = useI18n();
  const d = t.dashboard;
  const shop = useShop();
  // The greeting depends on the hour, which only the browser knows for sure.
  const [hour, setHour] = useState<number | null>(null);
  useEffect(() => {
    const id = setTimeout(() => setHour(clockIn(Date.now(), shop.timeZone).hour), 0);
    return () => clearTimeout(id);
  }, [shop.timeZone]);
  const name = viewer.kind === "owner" ? "" : viewer.name;
  const greeting = hour === null || !name ? (name ? d.hello(name) : d.helloOwner) : hour < 12 ? d.morning(name) : hour < 18 ? d.afternoon(name) : d.evening(name);

  const live = appointments.filter((a) => a.status === "booked" || a.status === "arrived");
  const waiting = queue.filter((q) => q.status === "waiting" || q.status === "called");
  const seen = queue.filter((q) => q.status === "done").length + appointments.filter((a) => a.status === "done" && !queue.some((q) => q.appointmentId === a.id)).length;
  const booked = appointments.filter((a) => a.status === "booked").length;
  const doctorName = (id: number) => doctors.find((x) => x.id === id)?.name ?? "";
  const inRoom = queue.filter((q) => q.status === "inRoom" || q.status === "called");
  const canQueue = viewer.sections.includes("queue");
  const canAppointments = viewer.sections.includes("appointments");

  const stats: { n: string; label: string }[] = [
    ...(canQueue ? [{ n: String(waiting.length), label: d.waiting }, { n: String(seen), label: d.seen }] : []),
    ...(canAppointments ? [{ n: String(booked), label: d.booked }] : []),
    ...(feesToday !== null ? [{ n: money(feesToday), label: d.feesToday }] : []),
  ];

  return (
    <PageBody>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-[28px]">{greeting}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{d.dayLine(t.weekdays[weekdayOf(day)], dayText(day), live.length)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canAppointments && (
            <Button asChild variant="outline">
              <Link href={shop.href("/dashboard/appointments")}>
                <CalendarDaysIcon />
                {d.openAppointments}
              </Link>
            </Button>
          )}
          {canQueue && (
            <Button asChild>
              <Link href={shop.href("/dashboard/queue")}>
                <ListOrderedIcon />
                {d.openQueue}
              </Link>
            </Button>
          )}
        </div>
      </div>

      {stats.length > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((s, i) => (
            <div key={s.label} className={cn("rounded-2xl p-4 shadow-soft", i === 0 ? "bg-primary text-primary-foreground" : "bg-card")}>
              <p className="tabular truncate text-2xl font-extrabold sm:text-[28px]">{s.n}</p>
              <p className={cn("text-xs font-semibold", i === 0 ? "opacity-85" : "text-muted-foreground")}>{s.label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          {canQueue && (
            <Card>
              <CardHeader>
                <CardTitle>{d.queueNow}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {inRoom.length + waiting.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">{d.queueEmpty}</p>
                ) : (
                  [...inRoom.filter((q) => q.status === "inRoom"), ...waiting].slice(0, 6).map((q) => (
                    <div key={q.id} className={cn("flex items-center gap-3 rounded-2xl p-3", q.status === "inRoom" && "bg-primary-soft")}>
                      <TurnNumber n={q.number} active={q.status === "inRoom"} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold">{q.patientName}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {t.patients.fileNo(q.fileNo)}
                          {doctors.length > 1 && ` · ${doctorName(q.doctorId)}`}
                        </p>
                      </div>
                      <Badge variant={q.status === "inRoom" ? "default" : "neutral"} className={q.status === "inRoom" ? "bg-primary text-primary-foreground" : ""}>
                        {t.queue.statuses[q.status]}
                      </Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          )}
          {setup && !(setup.doctors && setup.services && setup.patients) && (
            <Card>
              <CardHeader>
                <CardTitle>{d.gettingStarted}</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-3 text-sm">
                  {[
                    { done: setup.doctors, text: d.stepDoctors, href: "/dashboard/doctors" },
                    { done: setup.services, text: d.stepServices, href: "/dashboard/settings" },
                    { done: false, text: d.stepStaff, href: "/dashboard/staff" },
                    { done: false, text: d.stepScreen, href: "/dashboard/settings" },
                  ].map((s) => (
                    <li key={s.text}>
                      <Link href={shop.href(s.href)} className="flex items-start gap-3 hover:underline">
                        {s.done ? <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-primary" /> : <CircleIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
                        <span className={s.done ? "text-muted-foreground line-through" : ""}>{s.text}</span>
                      </Link>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4 lg:col-span-2">
          {canAppointments && (
            <Card>
              <CardHeader>
                <CardTitle>{d.upNext}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {live.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">{d.nothingNext}</p>
                ) : (
                  live.slice(0, 6).map((a) => (
                    <div key={a.id} className="flex items-center gap-3 rounded-2xl px-2 py-2">
                      <span className="tabular w-12 shrink-0 text-sm font-extrabold text-primary" dir="ltr">
                        {minutesToTime(a.startMin)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold">{a.patientName}</span>
                        <span className="block truncate text-xs text-muted-foreground">{[doctors.length > 1 ? doctorName(a.doctorId) : "", a.reason].filter(Boolean).join(" · ") || t.patients.fileNo(a.fileNo)}</span>
                      </span>
                      {a.status === "arrived" && <Badge>{t.appointments.statuses.arrived}</Badge>}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          )}
          {subscription && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCardIcon className="size-4 text-muted-foreground" />
                  {d.subscription}
                </CardTitle>
                <Badge variant={subscription.state === "grace" ? "accent" : "default"}>{t.states[subscription.state]}</Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-2xl font-extrabold">{subscription.plan ? t.plans[subscription.plan] : t.plans.none}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {subscription.state === "trial" && subscription.trialEndsAt
                      ? d.trialEnds(date(subscription.trialEndsAt))
                      : subscription.state === "grace" && subscription.paidUntil
                        ? d.graceUntil(date(subscription.paidUntil + GRACE_MS))
                        : subscription.paidUntil
                          ? d.paidUntil(date(subscription.paidUntil))
                          : null}
                  </p>
                </div>
                <Button asChild variant="outline" className="w-full">
                  <a href={subscription.accountUrl}>
                    {d.manage}
                    <ArrowUpRightIcon className="rtl:-scale-x-100" />
                  </a>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </PageBody>
  );
}
