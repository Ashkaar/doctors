import { SettingsScreen, type ClinicFacts } from "@/components/settings-screen";
import { clinicFeatures } from "@/lib/features";
import { listServices } from "@/lib/moneyDb";
import { requireSectionPage } from "@/lib/pageAccess";
import { getHours, getPrintSettings, getScreenKey } from "@/lib/settingsDb";
import { accountUrl, currentShop, profileOf } from "@/lib/tenant";

export default async function SettingsPage() {
  const { viewer } = await requireSectionPage("settings");
  const shop = await currentShop();
  const profile = profileOf(shop);
  const facts: ClinicFacts = {
    name: profile.name,
    branch: profile.branch,
    currency: profile.currency,
    plan: shop ? shop.plan : null,
    state: shop ? shop.state : null,
    accountUrl: shop ? accountUrl() : null,
  };
  const owner = viewer.isOwner;
  const [features, services, print, hours, screenKey] = await Promise.all([
    clinicFeatures(),
    owner ? listServices() : Promise.resolve([]),
    getPrintSettings(),
    getHours(),
    owner ? getScreenKey() : Promise.resolve(null),
  ]);
  return <SettingsScreen viewer={viewer} clinic={facts} features={features} services={services} print={print} hours={hours} screenKey={screenKey} />;
}
