import { ReportsScreen } from "@/components/reports/reports-screen";
import { daySchema } from "@/lib/clinic";
import { hasFeature, planIncludes } from "@/lib/features";
import { addDays } from "@/lib/format";
import { requireSectionPage } from "@/lib/pageAccess";
import { loadReport } from "@/lib/reportsDb";
import { requestToday } from "@/lib/settingsDb";

// ?from=YYYY-MM-DD&to=YYYY-MM-DD (both included). Default: this month.
export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  await requireSectionPage("reports");
  const { day: today, timeZone } = await requestToday();
  const q = await searchParams;
  const fromQ = daySchema.safeParse(q.from);
  const toQ = daySchema.safeParse(q.to);
  const from = fromQ.success ? fromQ.data : `${today.slice(0, 7)}-01`;
  const last = toQ.success && toQ.data >= from ? toQ.data : today;
  const [shares, expenses] = await Promise.all([hasFeature("shares"), planIncludes("expenses")]);
  const report = await loadReport(from, addDays(last, 1), timeZone, shares);
  return <ReportsScreen report={report} from={from} last={last} today={today} withShares={shares} withExpenses={expenses} />;
}
