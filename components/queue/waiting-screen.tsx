"use client";

import { StethoscopeIcon, Volume2Icon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ScreenState } from "@/lib/clinic";
import { getJson } from "@/lib/clientApi";
import { cn } from "@/lib/utils";
import { useI18n } from "../i18n-provider";
import { useShop } from "../shop-provider";

const POLL_MS = 4000;

// Two soft notes when a new number is called (after a tap turns sound on:
// browsers only allow sound after the page has been touched).
function chime(ctx: AudioContext) {
  const now = ctx.currentTime;
  for (const [i, freq] of [660, 880].entries()) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, now + i * 0.35);
    gain.gain.exponentialRampToValueAtTime(0.3, now + i * 0.35 + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.35 + 0.6);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now + i * 0.35);
    osc.stop(now + i * 0.35 + 0.65);
  }
}

export function WaitingScreen({ screenKey }: { screenKey: string }) {
  const { t } = useI18n();
  const w = t.screen;
  const { logoUrl, name } = useShop();
  const [state, setState] = useState<ScreenState | null>(null);
  const [bad, setBad] = useState(!screenKey);
  const [sound, setSound] = useState(false);
  const audio = useRef<AudioContext | null>(null);
  const last = useRef<string>("");

  useEffect(() => {
    if (!screenKey) return;
    let live = true;
    const load = async () => {
      try {
        const next = await getJson<ScreenState>(`/api/screen?key=${screenKey}`);
        if (!live) return;
        const top = next.calls[0] ? `${next.calls[0].number}:${next.calls[0].calledAt}` : "";
        if (top && last.current && top !== last.current && audio.current) chime(audio.current);
        last.current = top;
        setState(next);
        setBad(false);
      } catch (err) {
        if (live && err && typeof err === "object" && "status" in err && err.status === 404) setBad(true);
      }
    };
    const first = setTimeout(load, 0);
    const id = setInterval(load, POLL_MS);
    return () => {
      live = false;
      clearTimeout(first);
      clearInterval(id);
    };
  }, [screenKey]);

  const enableSound = () => {
    if (!audio.current) {
      audio.current = new AudioContext();
      chime(audio.current);
    }
    setSound(true);
  };

  if (bad) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background p-8 text-center">
        <p className="max-w-md text-lg font-bold text-muted-foreground">{w.badLink}</p>
      </main>
    );
  }

  const [now, ...earlier] = state?.calls ?? [];

  return (
    <main className="flex min-h-dvh flex-col bg-background p-6 sm:p-10" onClick={sound ? undefined : enableSound}>
      <header className="flex items-center gap-4">
        <span className="flex size-14 items-center justify-center overflow-hidden rounded-full bg-primary text-primary-foreground">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- the logo is served by Ariloo
            <img src={logoUrl} alt="" className="size-full object-cover" />
          ) : (
            <StethoscopeIcon className="size-7" />
          )}
        </span>
        <h1 className="min-w-0 flex-1 truncate text-2xl font-extrabold sm:text-3xl">{state?.clinic || name}</h1>
        {state && <span className="rounded-full bg-card px-5 py-2 text-lg font-bold shadow-soft">{w.waiting(state.waiting)}</span>}
      </header>

      <section className="flex flex-1 flex-col items-center justify-center gap-6 py-8 text-center" aria-live="polite">
        {now ? (
          <>
            <p className="text-2xl font-bold text-muted-foreground sm:text-3xl">{w.nowServing}</p>
            <p key={`${now.number}-${now.calledAt}`} className="tabular animate-in zoom-in-75 fade-in text-[min(38vw,22rem)] font-extrabold leading-none text-primary duration-500">
              {now.number}
            </p>
            <p className="text-3xl font-extrabold sm:text-5xl">{now.doctor}</p>
            {now.room && <p className="rounded-full bg-primary px-8 py-3 text-2xl font-extrabold text-primary-foreground sm:text-4xl">{w.room(now.room)}</p>}
          </>
        ) : (
          <p className="text-3xl font-bold text-muted-foreground">{w.nobody}</p>
        )}
      </section>

      {earlier.length > 0 && (
        <footer className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {earlier.map((c) => (
            <div key={`${c.number}-${c.calledAt}`} className="rounded-3xl bg-card p-4 text-center shadow-soft">
              <p className="tabular text-5xl font-extrabold">{c.number}</p>
              <p className="mt-1 truncate text-sm font-bold text-muted-foreground">{c.room ? `${c.doctor} · ${w.room(c.room)}` : c.doctor}</p>
            </div>
          ))}
        </footer>
      )}
      {!sound && (
        <button type="button" onClick={enableSound} className={cn("fixed bottom-4 end-4 flex cursor-pointer items-center gap-2 rounded-full bg-card px-4 py-2 text-sm font-bold shadow-soft")}>
          <Volume2Icon className="size-4" />
          {w.sound}
        </button>
      )}
    </main>
  );
}
