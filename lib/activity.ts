import "server-only";
import { and, asc, desc, eq, lt } from "drizzle-orm";
import { getDb } from "./db";
import { activityLog } from "./db/schema";
import { logError } from "./safeLog";

// Notes who did what (sign-ins, staff and settings changes) for the owner.
// Never fails the request it belongs to.
export async function logActivity(actor: string, action: string, detail = ""): Promise<void> {
  try {
    const db = await getDb();
    await db.insert(activityLog).values({ at: Date.now(), actor: actor.slice(0, 60), action: action.slice(0, 60), detail: detail.slice(0, 300) });
  } catch (err) {
    logError("record activity", err);
  }
}

export interface ActivityEntry {
  id: number;
  at: number;
  actor: string;
  action: string;
  detail: string;
}

// The owner's view of the log, newest first, `limit` at a time before `beforeId`.
export async function listActivity(limit: number, beforeId?: number, actor?: string): Promise<ActivityEntry[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(activityLog)
    .where(and(beforeId ? lt(activityLog.id, beforeId) : undefined, actor ? eq(activityLog.actor, actor) : undefined))
    .orderBy(desc(activityLog.id))
    .limit(limit);
  return rows;
}

export async function activityActors(): Promise<string[]> {
  const db = await getDb();
  const rows = await db.selectDistinct({ actor: activityLog.actor }).from(activityLog).orderBy(asc(activityLog.actor)).limit(200);
  return rows.map((r) => r.actor);
}
