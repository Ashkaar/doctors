"use client";

import { ArrowLeftIcon, HistoryIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ActivityEntry } from "@/lib/activity";
import type { Messages } from "@/lib/i18n";
import { Empty, NativeSelect } from "./clinic/fields";
import { useI18n } from "./i18n-provider";
import { PageBody, PageHeader } from "./page-header";
import { useShop } from "./shop-provider";
import { Button } from "./ui/button";
import { Card } from "./ui/card";

type ActionKey = keyof Messages["activity"]["actions"];

export function ActivityLog({ entries, more, actors, who }: { entries: ActivityEntry[]; more: boolean; actors: string[]; who: string | null }) {
  const { t, dateTime } = useI18n();
  const a = t.activity;
  const shop = useShop();
  const router = useRouter();
  const label = (action: string) => {
    const key = action.replace(/-([a-z])/gi, (_, c: string) => c.toUpperCase()) as ActionKey;
    return a.actions[key] ?? action;
  };
  const name = (actor: string) => (actor === "owner" ? t.common.ownerName : actor);
  const go = (params: { who?: string | null; before?: number }) => {
    const q = new URLSearchParams();
    if (params.who) q.set("who", params.who);
    if (params.before) q.set("before", String(params.before));
    router.push(shop.href(`/dashboard/staff/activity${q.size ? `?${q}` : ""}`));
  };

  return (
    <PageBody>
      <PageHeader title={a.title} description={a.intro}>
        <Button asChild variant="outline">
          <Link href={shop.href("/dashboard/staff")}>
            <ArrowLeftIcon className="rtl:-scale-x-100" />
            {t.staff.title}
          </Link>
        </Button>
      </PageHeader>
      {actors.length > 1 && (
        <div className="max-w-xs">
          <NativeSelect value={who ?? ""} onChange={(e) => go({ who: e.target.value || null })} aria-label={a.who}>
            <option value="">{a.everyone}</option>
            {actors.map((x) => (
              <option key={x} value={x}>
                {name(x)}
              </option>
            ))}
          </NativeSelect>
        </div>
      )}
      {entries.length === 0 ? (
        <Empty icon={HistoryIcon} text={a.none} />
      ) : (
        <Card className="p-2">
          <ul>
            {entries.map((e) => (
              <li key={e.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 rounded-2xl px-3 py-2.5 hover:bg-muted/40">
                <span className="tabular w-36 shrink-0 text-xs text-muted-foreground">{dateTime(e.at)}</span>
                <span className="font-bold">{name(e.actor)}</span>
                <span className="text-sm">{label(e.action)}</span>
                {e.detail && (
                  <span className="text-xs text-muted-foreground" dir="ltr">
                    {e.detail}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
      {more && (
        <div className="flex justify-center">
          <Button variant="soft" onClick={() => go({ who, before: entries[entries.length - 1].id })}>
            {a.older}
          </Button>
        </div>
      )}
    </PageBody>
  );
}
