import type { NextRequest } from "next/server";
import { logActivity } from "@/lib/activity";
import { actorOf, badRequest, notInPlan, requireOwner } from "@/lib/api";
import { CSV_TABLES, exportAllJson, exportCsv } from "@/lib/exportDb";
import { hasFeature } from "@/lib/features";
import { currentShop } from "@/lib/tenant";

// GET ?format=json → every record (without file contents) as one JSON file.
// GET ?format=csv&table=patients → one table as a spreadsheet file.
// Owner only, and only on a plan with export.
export async function GET(request: NextRequest) {
  const { viewer, error } = await requireOwner();
  if (error) return error;
  if (!(await hasFeature("export"))) return notInPlan();
  const q = request.nextUrl.searchParams;
  const slug = (await currentShop())?.slug ?? "clinic";
  const date = new Date().toISOString().slice(0, 10);
  const headers = (type: string, name: string) => ({ "Content-Type": type, "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" });
  if (q.get("format") === "json") {
    await logActivity(actorOf(viewer), "export", "json");
    return new Response(exportAllJson(slug), { headers: headers("application/json; charset=utf-8", `${slug}-${date}.json`) });
  }
  const table = q.get("table");
  if (q.get("format") === "csv" && CSV_TABLES.includes(table as (typeof CSV_TABLES)[number])) {
    await logActivity(actorOf(viewer), "export", `csv ${table}`);
    return new Response(exportCsv(table as (typeof CSV_TABLES)[number]), { headers: headers("text/csv; charset=utf-8", `${slug}-${table}-${date}.csv`) });
  }
  return badRequest();
}
