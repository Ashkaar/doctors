// Makes a local stand-in for Ariloo's database (.demo/ariloo.db) with an
// ariloo_shops table and three Doctors clinics, so the app can run in
// many-clinic mode on your computer:
//   city-clinic   free trial (every feature), filled by seed.mjs
//   late-clinic   paid until 2 days ago: open, with "payment overdue"
//   closed-clinic expired: shows the closed page
// Local demo only. Never point this at the real Ariloo database.
import { createClient } from "@libsql/client";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const dir = resolve(".demo");
mkdirSync(dir, { recursive: true });
const db = createClient({ url: `file:${dir}/ariloo.db` });
const now = Date.now();
const day = 24 * 60 * 60 * 1000;

await db.batch(
  [
    "DROP TABLE IF EXISTS ariloo_shops",
    `CREATE TABLE ariloo_shops (
      id INTEGER PRIMARY KEY, product TEXT NOT NULL, slug TEXT NOT NULL, business_name TEXT, branch_name TEXT,
      colour TEXT, currency TEXT, decimals INTEGER, lang TEXT, logo_mime TEXT, logo_version INTEGER,
      plan TEXT, trial_ends_at INTEGER, paid_until INTEGER, suspended INTEGER DEFAULT 0, db_url TEXT, created_at INTEGER
    )`,
    {
      sql: "INSERT INTO ariloo_shops VALUES (1,'doctors','city-clinic','City Clinic','Erbil','#0e7490','IQD',0,'en',NULL,0,NULL,?,NULL,0,?,?)",
      args: [now + 7 * day, `file:${dir}/city-clinic.db`, now - 30 * day],
    },
    {
      sql: "INSERT INTO ariloo_shops VALUES (2,'doctors','late-clinic','Shifa Clinic','Sulaymaniyah','#7c3aed','IQD',0,'ku',NULL,0,'starter',NULL,?,0,?,?)",
      args: [now - 2 * day, `file:${dir}/late-clinic.db`, now - 60 * day],
    },
    {
      sql: "INSERT INTO ariloo_shops VALUES (3,'doctors','closed-clinic','Noor Clinic','Duhok','#16a34a','USD',2,'ar',NULL,0,'pro',NULL,?,0,?,?)",
      args: [now - 20 * day, `file:${dir}/closed-clinic.db`, now - 90 * day],
    },
  ],
  "write",
);
console.log("Made .demo/ariloo.db with city-clinic (trial), late-clinic (payment overdue) and closed-clinic (expired).");
