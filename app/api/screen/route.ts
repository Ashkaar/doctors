import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { safeEqual } from "@/lib/passwords";
import { screenState } from "@/lib/scheduleDb";
import { getScreenKey, requestToday } from "@/lib/settingsDb";
import { currentShop, profileOf } from "@/lib/tenant";
import { logError } from "@/lib/safeLog";

// GET ?key= → what the waiting-room screen shows: the numbers being called
// and the doctor (and room) for each. Never a patient's name. Needs the
// clinic's screen key instead of a login, so a TV can show it all day.
export async function GET(request: NextRequest) {
  const none = () => NextResponse.json({ error: "Not found." }, { status: 404, headers: { "Cache-Control": "no-store" } });
  try {
    const shop = await currentShop();
    if (shop && !shop.open) return none();
    const key = request.nextUrl.searchParams.get("key") ?? "";
    const expected = await getScreenKey();
    if (!expected || !safeEqual(key, expected)) return none();
    const { day } = await requestToday();
    const profile = profileOf(shop);
    return NextResponse.json(await screenState(day, profile.branch ? `${profile.name} · ${profile.branch}` : profile.name), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    logError("read the waiting-room screen", err);
    return none();
  }
}
