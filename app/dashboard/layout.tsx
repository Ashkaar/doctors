import { AppShell } from "@/components/app-shell";
import { requireViewer } from "@/lib/pageAccess";
import { GRACE_MS } from "@/lib/shopState";
import { currentShop } from "@/lib/tenant";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireViewer();
  const shop = await currentShop();
  const graceUntil = shop?.state === "grace" && shop.paidUntil ? shop.paidUntil + GRACE_MS : null;
  return (
    <AppShell viewer={viewer} graceUntil={graceUntil}>
      {children}
    </AppShell>
  );
}
