import { ExpensesScreen } from "@/components/expenses-screen";
import { addDays } from "@/lib/format";
import { expenseCategories, listExpenses } from "@/lib/moneyDb";
import { requireSectionPage } from "@/lib/pageAccess";
import { requestToday } from "@/lib/settingsDb";

const monthStart = (day: string) => `${day.slice(0, 7)}-01`;
const nextMonth = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
};

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await requireSectionPage("expenses");
  const { day: today } = await requestToday();
  const asked = (await searchParams).month;
  const from = asked && /^\d{4}-\d{2}$/.test(asked) ? `${asked}-01` : monthStart(today);
  const to = nextMonth(from);
  const [expenses, categories] = await Promise.all([listExpenses(from, to), expenseCategories()]);
  return <ExpensesScreen month={from.slice(0, 7)} thisMonth={today.slice(0, 7)} prevMonth={monthStart(addDays(from, -1)).slice(0, 7)} nextMonth={to.slice(0, 7)} today={today} expenses={expenses} categories={categories} />;
}
