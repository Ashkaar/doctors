import "server-only";
import { randomBytes } from "crypto";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import { getDb } from "./db";
import { staff } from "./db/schema";
import { hashPassword, verifyPassword } from "./passwords";
import { isRole, isSection, OWNER_SECTIONS, type Role, type Section } from "./sections";
import type { StaffUser } from "./staff";

const newVersion = () => randomBytes(6).toString("hex");

function parsePermissions(raw: string): Section[] {
  try {
    const list: unknown = JSON.parse(raw);
    return Array.isArray(list) ? list.filter((s): s is Section => isSection(s) && !OWNER_SECTIONS.includes(s)) : [];
  } catch {
    return [];
  }
}

function toUser(r: typeof staff.$inferSelect): StaffUser {
  return {
    id: r.id,
    name: r.name,
    role: isRole(r.role) ? r.role : "reception",
    permissions: parsePermissions(r.permissions),
    ownPatientsOnly: r.ownPatientsOnly === 1,
    active: r.active === 1,
    createdAt: r.createdAt,
  };
}

export async function listStaff(): Promise<StaffUser[]> {
  const db = await getDb();
  return (await db.select().from(staff).orderBy(asc(staff.name))).map(toUser);
}

// For the sign-in screen: names only.
export async function listActiveStaffNames(): Promise<{ id: number; name: string }[]> {
  const db = await getDb();
  return db.select({ id: staff.id, name: staff.name }).from(staff).where(eq(staff.active, 1)).orderBy(asc(staff.name));
}

export async function getStaffSession(id: number, version: string): Promise<StaffUser | null> {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(staff)
    .where(and(eq(staff.id, id), eq(staff.version, version), eq(staff.active, 1)));
  return row ? toUser(row) : null;
}

export async function checkStaffLogin(id: number, password: string): Promise<{ user: StaffUser; version: string } | null> {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(staff)
    .where(and(eq(staff.id, id), eq(staff.active, 1)));
  if (!row || !(await verifyPassword(password, row.passwordHash))) return null;
  return { user: toUser(row), version: row.version };
}

export async function staffNameTaken(name: string, exceptId = 0): Promise<boolean> {
  const db = await getDb();
  const rows = await db
    .select({ id: staff.id })
    .from(staff)
    .where(and(sql`${staff.name} = ${name} COLLATE NOCASE`, ne(staff.id, exceptId)));
  return rows.length > 0;
}

export async function createStaff(name: string, password: string, role: Role, permissions: Section[], ownPatientsOnly: boolean): Promise<StaffUser> {
  const db = await getDb();
  const [row] = await db
    .insert(staff)
    .values({
      name,
      role,
      ownPatientsOnly: ownPatientsOnly ? 1 : 0,
      passwordHash: await hashPassword(password),
      permissions: JSON.stringify(permissions),
      active: 1,
      version: newVersion(),
      createdAt: Date.now(),
    })
    .returning();
  return toUser(row);
}

export interface StaffChanges {
  name?: string;
  password?: string;
  role?: Role;
  permissions?: Section[];
  ownPatientsOnly?: boolean;
  active?: boolean;
}

// A new password or turning the login off ends that user's sessions.
export async function updateStaff(id: number, changes: StaffChanges): Promise<StaffUser | null> {
  const db = await getDb();
  const set: Partial<typeof staff.$inferInsert> = {};
  if (changes.name !== undefined) set.name = changes.name;
  if (changes.permissions !== undefined) set.permissions = JSON.stringify(changes.permissions);
  if (changes.role !== undefined) set.role = changes.role;
  if (changes.ownPatientsOnly !== undefined) set.ownPatientsOnly = changes.ownPatientsOnly ? 1 : 0;
  if (changes.active !== undefined) set.active = changes.active ? 1 : 0;
  if (changes.password !== undefined) set.passwordHash = await hashPassword(changes.password);
  if (changes.password !== undefined || changes.active === false) set.version = newVersion();
  if (Object.keys(set).length === 0) {
    const [row] = await db.select().from(staff).where(eq(staff.id, id));
    return row ? toUser(row) : null;
  }
  const [row] = await db.update(staff).set(set).where(eq(staff.id, id)).returning();
  return row ? toUser(row) : null;
}

export async function deleteStaff(id: number): Promise<boolean> {
  const db = await getDb();
  const rows = await db.delete(staff).where(eq(staff.id, id)).returning({ id: staff.id });
  return rows.length > 0;
}
