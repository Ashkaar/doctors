"use client";

import { ChevronDownIcon } from "lucide-react";
import { useId } from "react";
import { cn } from "@/lib/utils";
import { Label } from "../ui/label";

// Small form helpers shared by the clinic's screens.

export function Field({ label, hint, className, children }: { label: string; hint?: string; className?: string; children: (id: string) => React.ReactNode }) {
  const id = useId();
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children(id)}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

// A plain <select>: the phone's own picker on phones, no empty-value limits.
export function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className={cn("relative", className)}>
      <select
        className="h-10 w-full cursor-pointer appearance-none rounded-xl border border-input bg-card ps-3 pe-9 text-base text-foreground shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
        {...props}
      >
        {children}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

// A row of round choice chips (radio group).
export function Chips<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-9 cursor-pointer rounded-full px-4 text-sm font-bold transition-colors",
            value === o.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-highlight hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// An empty state inside a card or list.
export function Empty({ icon: Icon, text, children }: { icon?: React.ComponentType<{ className?: string }>; text: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl bg-muted/40 px-4 py-10 text-center text-sm text-muted-foreground">
      {Icon && <Icon className="size-8 opacity-60" />}
      <p>{text}</p>
      {children}
    </div>
  );
}

// A round turn number, as on the queue and the waiting-room screen.
export function TurnNumber({ n, active = false, className }: { n: number; active?: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "tabular flex size-11 shrink-0 items-center justify-center rounded-full text-[17px] font-extrabold",
        active ? "bg-primary text-primary-foreground" : "bg-background text-foreground",
        className,
      )}
    >
      {n}
    </span>
  );
}
