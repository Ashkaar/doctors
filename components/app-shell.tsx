"use client";

import { EllipsisIcon, StethoscopeIcon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { Section, Viewer } from "@/lib/sections";
import { cn } from "@/lib/utils";
import { useI18n } from "./i18n-provider";
import { isActive, navItems } from "./nav";
import { useAppPathname, useShop } from "./shop-provider";
import { Sheet, SheetContent, SheetTitle } from "./ui/sheet";
import { UpdatesBell } from "./updates-bell";
import { UserMenu } from "./user-menu";

// The frame around every signed-in screen, in the "warm calm" design.
// - Tablets and computers: the clinic's logo and the sections on the start
//   side (left, or right in Kurdish and Arabic) as soft round pills on the
//   page itself; the bell and the account menu in the top corner.
// - Phones: a slim top bar, and a floating round tab bar with the main
//   sections plus "More" for the rest.
// While a payment is overdue (grace), a banner says so on every screen.
export function AppShell({ viewer, graceUntil, children }: { viewer: Viewer; graceUntil: number | null; children: React.ReactNode }) {
  const { t } = useI18n();
  const items = navItems(viewer.sections, t);
  const settings = items.find((i) => i.section === "settings");
  const sideItems = items.filter((i) => i !== settings);

  return (
    <div className="flex min-h-dvh">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-50 focus:rounded-full focus:bg-card focus:px-4 focus:py-2"
      >
        {t.nav.skipToContent}
      </a>
      <aside className="no-print sticky top-0 hidden h-dvh w-60 shrink-0 flex-col bg-sidebar md:flex lg:w-64">
        <ClinicMark className="h-20 shrink-0 px-5" />
        <nav aria-label={t.nav.main} className="flex-1 space-y-1 overflow-y-auto px-3 py-1">
          {sideItems.map((item) => (
            <SideLink key={item.section} {...item} />
          ))}
        </nav>
        {settings && (
          <div className="px-3 py-4">
            <SideLink {...settings} />
          </div>
        )}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-30 flex h-14 items-center gap-2 bg-background/90 px-4 backdrop-blur md:hidden">
          <ClinicMark className="min-w-0 flex-1" compact />
          <UpdatesBell />
          <UserMenu viewer={viewer} compact />
        </header>
        <header className="no-print sticky top-0 z-30 hidden h-16 items-center justify-end gap-2 bg-background/90 px-6 backdrop-blur md:flex">
          <UpdatesBell />
          <UserMenu viewer={viewer} compact showName />
        </header>
        {graceUntil && <GraceBanner until={graceUntil} />}
        <main id="content" className="flex-1 pb-28 md:pb-10">
          {children}
        </main>
      </div>

      <TabBar sections={viewer.sections} />
    </div>
  );
}

function GraceBanner({ until }: { until: number }) {
  const { t, date } = useI18n();
  const { accountUrl } = useShop();
  return (
    <div className="no-print mx-4 mt-2 flex flex-wrap items-center gap-3 rounded-2xl bg-accent-100 px-4 py-3 text-sm font-semibold text-accent-900 sm:mx-6 dark:bg-accent-500/15 dark:text-accent-200">
      <TriangleAlertIcon className="size-5 shrink-0" />
      <span className="min-w-0 flex-1">{t.dashboard.graceBanner(date(until))}</span>
      {accountUrl && (
        <a href={accountUrl} className="rounded-full bg-accent-700 px-4 py-1.5 text-xs font-bold text-surface-0 hover:bg-accent-800">
          {t.dashboard.pay}
        </a>
      )}
    </div>
  );
}

function ClinicMark({ className, compact = false }: { className?: string; compact?: boolean }) {
  const { name, branch, logoUrl, href } = useShop();
  return (
    <Link href={href("/dashboard")} className={cn("flex items-center gap-3", className)}>
      <span className={cn("flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-primary-foreground", compact ? "size-8" : "size-11")}>
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- the logo is served by Ariloo
          <img src={logoUrl} alt="" className="size-full object-cover" />
        ) : (
          <StethoscopeIcon className={compact ? "size-4" : "size-5"} />
        )}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-extrabold leading-tight">{name}</span>
        {branch && <span className="block truncate text-xs text-muted-foreground">{branch}</span>}
      </span>
    </Link>
  );
}

function SideLink({ href, label, icon: Icon }: { href: string; label: string; icon: React.ComponentType<{ className?: string }> }) {
  const path = useAppPathname();
  const shop = useShop();
  const active = isActive(path, href);
  return (
    <Link
      href={shop.href(href)}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-full px-4 py-2.5 text-sm transition-colors",
        active ? "bg-card font-bold text-foreground shadow-soft" : "font-semibold text-muted-foreground hover:bg-card/60 hover:text-foreground",
      )}
    >
      <Icon className={cn("size-[18px] shrink-0", active && "text-primary")} />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function TabBar({ sections }: { sections: readonly Section[] }) {
  const { t } = useI18n();
  const path = useAppPathname();
  const shop = useShop();
  const [more, setMore] = useState(false);
  const items = navItems(sections, t);
  const primary = items.filter((i) => i.primary).slice(0, 4);
  const rest = items.filter((i) => !primary.includes(i));
  const restActive = rest.some((i) => isActive(path, i.href));

  const tab = (active: boolean) =>
    cn("flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-[11px] font-bold", active ? "text-primary" : "text-muted-foreground");

  return (
    <nav
      aria-label={t.nav.main}
      className="no-print fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-30 flex h-16 rounded-full bg-card/95 px-2 shadow-[var(--shadow-float)] backdrop-blur md:hidden"
    >
      {primary.map(({ section, href, label, icon: Icon }) => (
        <Link key={section} href={shop.href(href)} className={tab(isActive(path, href))} aria-current={isActive(path, href) ? "page" : undefined}>
          <Icon className="size-5" />
          <span className="max-w-full truncate px-1">{label}</span>
        </Link>
      ))}
      {rest.length > 0 && (
        <Sheet open={more} onOpenChange={setMore}>
          <button type="button" className={cn(tab(restActive), "cursor-pointer")} onClick={() => setMore(true)}>
            <EllipsisIcon className="size-5" />
            <span>{t.nav.more}</span>
          </button>
          <SheetContent side="bottom" closeLabel={t.common.close} className="p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <SheetTitle className="px-2">{t.nav.more}</SheetTitle>
            <div className="grid grid-cols-3 gap-2">
              {rest.map(({ section, href, label, icon: Icon }) => (
                <Link
                  key={section}
                  href={shop.href(href)}
                  onClick={() => setMore(false)}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-2xl p-4 text-center text-sm font-bold",
                    isActive(path, href) ? "bg-primary-soft text-primary-soft-foreground" : "bg-muted/60 hover:bg-highlight",
                  )}
                >
                  <Icon className="size-6" />
                  <span className="max-w-full truncate">{label}</span>
                </Link>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      )}
    </nav>
  );
}
