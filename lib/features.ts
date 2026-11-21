import "server-only";
import { featuresInPlan, sectionsInPlan, type Feature } from "./plans";
import type { Section } from "./sections";
import { currentShop, multiShop } from "./tenant";

// The features this clinic's plan includes.
export async function clinicFeatures(): Promise<readonly Feature[]> {
  const shop = await currentShop();
  return featuresInPlan(shop?.plan ?? null, !multiShop());
}

export async function hasFeature(feature: Feature): Promise<boolean> {
  return (await clinicFeatures()).includes(feature);
}

// Whether the clinic's plan includes a section at all (whoever is signed in).
export async function planIncludes(section: Section): Promise<boolean> {
  const shop = await currentShop();
  return sectionsInPlan(shop?.plan ?? null, !multiShop()).includes(section);
}
