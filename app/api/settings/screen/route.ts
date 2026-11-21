import { logActivity } from "@/lib/activity";
import { actorOf, ok, requireOwner, serverError } from "@/lib/api";
import { newScreenKey } from "@/lib/settingsDb";

// POST → a new link for the waiting-room screen (old links stop). Owner only.
export async function POST() {
  const { viewer, error } = await requireOwner();
  if (error) return error;
  try {
    const key = await newScreenKey();
    await logActivity(actorOf(viewer), "screen-link");
    return ok({ key });
  } catch (err) {
    return serverError("make a screen link", err);
  }
}
