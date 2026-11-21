import { WaitingScreen } from "@/components/queue/waiting-screen";
import { shopUsable } from "@/lib/pageAccess";

// The waiting-room screen (a TV or tablet): no sign-in, the clinic's screen
// key in the address instead. Shows only numbers and doctors.
export default async function ScreenPage({ searchParams }: { searchParams: Promise<{ key?: string }> }) {
  if (!(await shopUsable())) return null;
  const key = (await searchParams).key ?? "";
  return <WaitingScreen screenKey={/^[a-f0-9]{32}$/.test(key) ? key : ""} />;
}

export const metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" as const };
