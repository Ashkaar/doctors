import { getShopDb } from "@/lib/db";
import { ok, requireLogin } from "@/lib/api";
import { logError } from "@/lib/safeLog";

// GET → { ok, db } after a SELECT 1 on the shop's database (signed in only).
export async function GET() {
  const { error } = await requireLogin();
  if (error) return error;
  try {
    const { client } = await getShopDb();
    await client.execute("SELECT 1");
    return ok({ ok: true, db: "ok" });
  } catch (err) {
    logError("check health", err);
    return ok({ ok: false, db: "unreachable" }, 503);
  }
}
