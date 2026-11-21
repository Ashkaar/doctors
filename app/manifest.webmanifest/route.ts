import { NextResponse } from "next/server";
import { currentShop, shopBase } from "@/lib/tenant";

export const dynamic = "force-dynamic";

// The installable app's manifest, per shop: it carries the shop's name and
// opens at the clinic's Today screen.
export async function GET() {
  const base = await shopBase();
  let name = "Doctors";
  let colour = "#0e7490";
  try {
    const shop = await currentShop();
    if (shop) {
      name = shop.branch ? `${shop.name} · ${shop.branch}` : shop.name;
      if (/^#[0-9a-f]{6}$/i.test(shop.colour)) colour = shop.colour;
    }
  } catch {
    // No such shop: a plain Doctors manifest.
  }
  return NextResponse.json(
    {
      name,
      short_name: name.slice(0, 24),
      id: `${base}/`,
      start_url: `${base}/dashboard`,
      scope: `${base}/`,
      display: "standalone",
      background_color: "#f4efe7",
      theme_color: colour,
      icons: [
        { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
        { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "no-store" } },
  );
}
