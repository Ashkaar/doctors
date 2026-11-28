import { ActivityLog } from "@/components/activity-log";
import { UnlockGate } from "@/components/unlock-gate";
import { activityActors, listActivity } from "@/lib/activity";
import { requireSectionPage } from "@/lib/pageAccess";

const PAGE = 100;

// Who opened, changed, deleted or exported which record. Owner only (the
// Staff section). Details name record numbers, never medical text.
export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ before?: string; who?: string }> }) {
  const { locked } = await requireSectionPage("staff");
  if (locked) return <UnlockGate />;
  const q = await searchParams;
  const before = Number(q.before) > 0 ? Number(q.before) : undefined;
  const who = q.who && q.who.length <= 60 ? q.who : undefined;
  const [entries, actors] = await Promise.all([listActivity(PAGE + 1, before, who), activityActors()]);
  return <ActivityLog entries={entries.slice(0, PAGE)} more={entries.length > PAGE} actors={actors} who={who ?? null} />;
}
