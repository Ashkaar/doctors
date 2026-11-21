"use client";

import { BellRingIcon, ListOrderedIcon, MonitorIcon, UserPlusIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { Doctor, QueueStatus, QueueTicket } from "@/lib/clinic";
import { errorMessage, getJson, sendJson } from "@/lib/clientApi";
import { cn } from "@/lib/utils";
import { WalkInDialog } from "../clinic/booking";
import { Empty, TurnNumber } from "../clinic/fields";
import { useI18n } from "../i18n-provider";
import { PageBody, PageHeader } from "../page-header";
import { useShop } from "../shop-provider";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

const POLL_MS = 10_000;
const ACTIVE: QueueStatus[] = ["called", "inRoom", "waiting"];

// Today's queue: a column per doctor (one on phones, picked with chips).
// It refreshes every 10 seconds, so reception and doctors see the same.
export function QueueScreen({
  day,
  doctors,
  initial,
  myDoctorId,
  canVisit,
  showAlerts,
  isOwner,
}: {
  day: string;
  doctors: Doctor[];
  initial: QueueTicket[];
  myDoctorId: number | null;
  canVisit: boolean;
  showAlerts: boolean;
  isOwner: boolean;
}) {
  const { t } = useI18n();
  const q = t.queue;
  const shop = useShop();
  const router = useRouter();
  const [tickets, setTickets] = useState(initial);
  const [now, setNow] = useState(0);
  const [walkIn, setWalkIn] = useState<number | null | false>(false);
  const [focus, setFocus] = useState<number | null>(myDoctorId ?? doctors[0]?.id ?? null);

  const refresh = useCallback(async () => {
    try {
      const res = await getJson<{ day: string; queue: QueueTicket[] }>("/api/queue");
      if (res.day !== day) router.refresh();
      setTickets(res.queue);
    } catch {
      // Offline for a moment: keep showing the last list.
    }
  }, [day, router]);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(() => {
      if (document.visibilityState === "visible") {
        void refresh();
        tick();
      }
    }, POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [refresh]);

  const setStatus = async (ticket: QueueTicket, status: QueueStatus) => {
    try {
      await sendJson(`/api/queue/${ticket.id}`, "PATCH", { status });
      await refresh();
    } catch (err) {
      toast.error(errorMessage(err, t.common.somethingWrong));
    }
  };

  const callNext = async (doctorId: number) => {
    try {
      const { ticket } = await sendJson<{ ticket: QueueTicket | null }>("/api/queue/next", "POST", { doctorId });
      if (ticket) toast.success(q.called(ticket.number));
      else toast(q.nobodyWaiting);
      await refresh();
    } catch (err) {
      toast.error(errorMessage(err, t.common.somethingWrong));
    }
  };

  const seeNow = async (ticket: QueueTicket) => {
    try {
      const { id } = await sendJson<{ id: number }>("/api/visits", "POST", { patientId: ticket.patientId, ticketId: ticket.id });
      router.push(shop.href(`/dashboard/visits/${id}`));
    } catch (err) {
      toast.error(errorMessage(err, t.common.somethingWrong));
    }
  };

  if (doctors.length === 0) {
    return (
      <PageBody>
        <PageHeader title={q.title} />
        <Empty icon={ListOrderedIcon} text={t.doctors.needOne}>
          {isOwner && (
            <Button asChild variant="soft">
              <Link href={shop.href("/dashboard/doctors")}>{t.doctors.add}</Link>
            </Button>
          )}
        </Empty>
      </PageBody>
    );
  }

  const column = (doctor: Doctor) => {
    const mine = tickets.filter((x) => x.doctorId === doctor.id);
    const active = mine.filter((x) => ACTIVE.includes(x.status)).sort((a, b) => ACTIVE.indexOf(a.status) - ACTIVE.indexOf(b.status) || a.number - b.number);
    const finished = mine.filter((x) => !ACTIVE.includes(x.status));
    return (
      <Card key={doctor.id} className={cn(doctors.length > 1 && focus !== doctor.id && "hidden md:block")}>
        <CardHeader className="items-center">
          <div className="min-w-0">
            <CardTitle className="truncate">{doctor.name}</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">{[doctor.specialty, doctor.room ? t.doctors.roomShort(doctor.room) : ""].filter(Boolean).join(" · ")}</p>
          </div>
          <Button size="sm" onClick={() => callNext(doctor.id)}>
            <BellRingIcon />
            {q.callNext}
          </Button>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {active.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">{q.nobodyWaiting}</p>}
          {active.map((x) => {
            const waited = now ? Math.floor((now - x.createdAt) / 60_000) : 0;
            const here = x.status === "inRoom" || x.status === "called";
            return (
              <div key={x.id} className={cn("rounded-2xl p-3", here ? "bg-primary-soft" : "bg-muted/40")}>
                <div className="flex items-center gap-3">
                <TurnNumber n={x.number} active={here} />
                <div className="min-w-0 flex-1">
                  <Link href={shop.href(`/dashboard/patients/${x.patientId}`)} className="block truncate text-sm font-bold hover:underline">
                    {x.patientName}
                  </Link>
                  <p className="truncate text-xs text-muted-foreground">
                    {t.patients.fileNo(x.fileNo)} · {x.status === "waiting" ? q.waitingFor(waited) : q.statuses[x.status]}
                  </p>
                </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5 ps-14">
                  {x.status === "waiting" && (
                    <Button size="sm" variant="outline" onClick={() => setStatus(x, "called")}>
                      {q.call}
                    </Button>
                  )}
                  {canVisit && x.status !== "inRoom" && (
                    <Button size="sm" onClick={() => seeNow(x)}>
                      {q.seeNow}
                    </Button>
                  )}
                  {canVisit && x.status === "inRoom" && x.visitId && (
                    <Button size="sm" asChild>
                      <Link href={shop.href(`/dashboard/visits/${x.visitId}`)}>{t.visits.open}</Link>
                    </Button>
                  )}
                  {here && (
                    <Button size="sm" variant="soft" onClick={() => setStatus(x, "done")}>
                      {q.done}
                    </Button>
                  )}
                  {x.status === "waiting" && (
                    <Button size="sm" variant="ghost" onClick={() => setStatus(x, "left")}>
                      {q.left}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
          {finished.length > 0 && (
            <details className="pt-2">
              <summary className="cursor-pointer px-1 text-xs font-bold text-muted-foreground">
                {q.finished} ({finished.length})
              </summary>
              <ul className="mt-2 space-y-1">
                {finished.map((x) => (
                  <li key={x.id} className="flex items-center gap-3 rounded-xl px-2 py-1.5 text-sm">
                    <span className="tabular w-8 text-center font-bold text-muted-foreground">{x.number}</span>
                    <span className="min-w-0 flex-1 truncate">{x.patientName}</span>
                    <Badge variant="neutral">{q.statuses[x.status]}</Badge>
                    <Button size="sm" variant="ghost" onClick={() => setStatus(x, "waiting")}>
                      {q.backToWaiting}
                    </Button>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <PageBody wide>
      <PageHeader title={q.title} description={q.intro}>
        {isOwner && (
          <Button asChild variant="outline">
            <Link href={shop.href("/dashboard/settings#screen")}>
              <MonitorIcon />
              {q.screen}
            </Link>
          </Button>
        )}
        <Button onClick={() => setWalkIn(focus)}>
          <UserPlusIcon />
          {q.walkIn}
        </Button>
      </PageHeader>
      {doctors.length > 1 && (
        <div className="flex gap-2 overflow-x-auto md:hidden">
          {doctors.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setFocus(d.id)}
              className={cn("h-9 shrink-0 cursor-pointer rounded-full px-4 text-sm font-bold", focus === d.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}
            >
              {d.name}
            </button>
          ))}
        </div>
      )}
      <div className={cn("grid grid-cols-1 gap-4", doctors.length > 1 && "md:grid-cols-2", doctors.length > 2 && "xl:grid-cols-3")}>{doctors.map(column)}</div>
      {walkIn !== false && (
        <WalkInDialog
          open
          onOpenChange={(o) => !o && setWalkIn(false)}
          doctors={doctors}
          today={day}
          showAlerts={showAlerts}
          doctorId={walkIn}
          onSaved={(ticket) => {
            toast.success(t.appointments.arrivedDone(ticket.number));
            void refresh();
          }}
        />
      )}
    </PageBody>
  );
}
