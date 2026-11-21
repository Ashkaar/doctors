"use client";

import { ChevronLeftIcon, ChevronRightIcon, PlusIcon, Trash2Icon, WalletIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import type { Expense } from "@/lib/clinic";
import { errorMessage, sendJson } from "@/lib/clientApi";
import { Empty, Field } from "./clinic/fields";
import { ConfirmDialog } from "./confirm-dialog";
import { FormError } from "./form-error";
import { useI18n } from "./i18n-provider";
import { MoneyInput } from "./money-input";
import { PageBody, PageHeader } from "./page-header";
import { useShop } from "./shop-provider";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";

export function ExpensesScreen({
  month,
  thisMonth,
  prevMonth,
  nextMonth,
  today,
  expenses,
  categories,
}: {
  month: string;
  thisMonth: string;
  prevMonth: string;
  nextMonth: string;
  today: string;
  expenses: Expense[];
  categories: string[];
}) {
  const { t, money, day: dayText, dir } = useI18n();
  const e = t.expenses;
  const shop = useShop();
  const router = useRouter();
  const listId = useId();
  const [adding, setAdding] = useState(false);
  const [remove, setRemove] = useState<number | null>(null);
  const [day, setDay] = useState(today);
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState<number | null>(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const total = expenses.reduce((s, x) => s + x.amount, 0);
  const [y, m] = month.split("-").map(Number);
  const go = (to: string) => router.push(shop.href(to === thisMonth ? "/dashboard/expenses" : `/dashboard/expenses?month=${to}`));
  const Prev = dir === "rtl" ? ChevronRightIcon : ChevronLeftIcon;
  const Next = dir === "rtl" ? ChevronLeftIcon : ChevronRightIcon;

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!amount) return;
    setBusy(true);
    setError(null);
    try {
      await sendJson("/api/expenses", "POST", { day, category, description, amount });
      setAdding(false);
      setDescription("");
      setAmount(0);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err, t.common.somethingWrong));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageBody>
      <PageHeader title={e.title} description={e.intro}>
        <Button onClick={() => setAdding(true)}>
          <PlusIcon />
          {e.add}
        </Button>
      </PageHeader>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-full bg-card p-1 shadow-soft">
          <Button variant="ghost" size="icon-sm" aria-label={t.common.previous} onClick={() => go(prevMonth)}>
            <Prev />
          </Button>
          <span className="px-3 text-sm font-extrabold">
            {t.monthsLong[m - 1]} {y}
          </span>
          <Button variant="ghost" size="icon-sm" aria-label={t.common.next} onClick={() => go(nextMonth)} disabled={month >= thisMonth}>
            <Next />
          </Button>
        </div>
        <div className="rounded-2xl bg-primary px-5 py-2 text-primary-foreground">
          <span className="text-xs font-semibold opacity-85">{e.monthTotal} </span>
          <span className="tabular text-lg font-extrabold">{money(total)}</span>
        </div>
      </div>
      {expenses.length === 0 ? (
        <Empty icon={WalletIcon} text={e.none} />
      ) : (
        <Card className="p-2">
          <ul className="space-y-1">
            {expenses.map((x) => (
              <li key={x.id} className="flex items-center gap-3 rounded-2xl px-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{x.category || x.description || "—"}</span>
                  <span className="block truncate text-xs text-muted-foreground">{[dayText(x.day), x.category ? x.description : ""].filter(Boolean).join(" · ")}</span>
                </span>
                <span className="tabular text-sm font-extrabold">{money(x.amount)}</span>
                <Button variant="ghost" size="icon-sm" aria-label={t.common.delete} onClick={() => setRemove(x.id)}>
                  <Trash2Icon />
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent closeLabel={t.common.close}>
          <DialogHeader>
            <DialogTitle>{e.newTitle}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label={e.day}>{(id) => <Input id={id} type="date" value={day} max={today} onChange={(ev) => setDay(ev.target.value)} required />}</Field>
              <Field label={e.amount}>{(id) => <MoneyInput id={id} cents={amount ?? 0} onChange={setAmount} />}</Field>
            </div>
            <Field label={e.category}>
              {(id) => <Input id={id} value={category} onChange={(ev) => setCategory(ev.target.value)} list={listId} placeholder={e.categoryPlaceholder} maxLength={60} />}
            </Field>
            <datalist id={listId}>
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <Field label={e.description}>{(id) => <Input id={id} value={description} onChange={(ev) => setDescription(ev.target.value)} maxLength={200} />}</Field>
            <FormError message={error} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAdding(false)}>
                {t.common.cancel}
              </Button>
              <Button type="submit" disabled={busy || !amount}>
                {busy ? t.common.saving : t.common.save}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={remove !== null}
        onOpenChange={(o) => !o && setRemove(null)}
        title={e.deleteTitle}
        confirmLabel={t.common.delete}
        destructive
        onConfirm={async () => {
          await sendJson(`/api/expenses/${remove}`, "DELETE");
          setRemove(null);
          router.refresh();
        }}
      />
    </PageBody>
  );
}
