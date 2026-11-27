import "server-only";
import type { Client } from "@libsql/client";

// Creates a clinic's tables on first use. Every statement is safe to run
// again, so setup runs once per database per server instance (lib/db/index.ts).
//
// To change the database later: add new tables to SCHEMA, and new columns
// of existing tables to ADDED_COLUMNS (never edit a CREATE TABLE that has
// shipped). Keep lib/db/schema.ts in step; tests/schema.test.ts checks it.
//
// A new clinic starts EMPTY: no sample patients, services or medicines.

export const SCHEMA: string[] = [
  `CREATE TABLE IF NOT EXISTS clinic_secrets (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS clinic_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS staff (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'reception',
    password_hash TEXT NOT NULL,
    permissions TEXT NOT NULL DEFAULT '[]',
    own_patients_only INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    version TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  "CREATE UNIQUE INDEX IF NOT EXISTS staff_name ON staff (name COLLATE NOCASE)",
  // Who did what: sign-ins, and opening, changing, deleting or exporting
  // patient records. Holds names and record numbers, never medical text.
  `CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    at INTEGER NOT NULL,
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    detail TEXT NOT NULL DEFAULT ''
  )`,
  "CREATE INDEX IF NOT EXISTS activity_log_at ON activity_log (at)",

  // ---- Doctors ----
  // share_bp: the doctor's share of their fees, in hundredths of a percent.
  `CREATE TABLE IF NOT EXISTS doctors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    specialty TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    licence TEXT NOT NULL DEFAULT '',
    room TEXT NOT NULL DEFAULT '',
    staff_id INTEGER,
    share_bp INTEGER NOT NULL DEFAULT 0,
    slot_minutes INTEGER NOT NULL DEFAULT 15,
    active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL
  )`,

  // ---- Patients ----
  // file_no: the clinic's own running patient number, shown on every page.
  // birth_date: "YYYY-MM-DD", or "YYYY" when only the age is known.
  `CREATE TABLE IF NOT EXISTS patients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_no INTEGER NOT NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    gender TEXT NOT NULL DEFAULT '',
    birth_date TEXT NOT NULL DEFAULT '',
    blood_group TEXT NOT NULL DEFAULT '',
    allergies TEXT NOT NULL DEFAULT '',
    conditions TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  "CREATE UNIQUE INDEX IF NOT EXISTS patients_file_no ON patients (file_no)",
  "CREATE INDEX IF NOT EXISTS patients_name ON patients (name COLLATE NOCASE)",
  "CREATE INDEX IF NOT EXISTS patients_phone ON patients (phone)",

  // ---- Appointments and the queue ----
  // day: "YYYY-MM-DD" in the clinic's time zone; start_min: minutes after midnight.
  `CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL,
    doctor_id INTEGER NOT NULL,
    day TEXT NOT NULL,
    start_min INTEGER NOT NULL,
    duration_min INTEGER NOT NULL DEFAULT 15,
    status TEXT NOT NULL DEFAULT 'booked',
    reason TEXT NOT NULL DEFAULT '',
    created_by TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  "CREATE INDEX IF NOT EXISTS appointments_day ON appointments (day, doctor_id)",
  "CREATE INDEX IF NOT EXISTS appointments_patient ON appointments (patient_id)",
  // A turn in the day's queue. `number` counts up from 1 each day for the
  // whole clinic and is all the waiting-room screen ever shows.
  `CREATE TABLE IF NOT EXISTS queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day TEXT NOT NULL,
    number INTEGER NOT NULL,
    patient_id INTEGER NOT NULL,
    doctor_id INTEGER NOT NULL,
    appointment_id INTEGER,
    visit_id INTEGER,
    status TEXT NOT NULL DEFAULT 'waiting',
    called_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  "CREATE UNIQUE INDEX IF NOT EXISTS queue_day_number ON queue (day, number)",
  "CREATE INDEX IF NOT EXISTS queue_patient ON queue (patient_id)",

  // ---- Visits (the medical record) ----
  // vitals: JSON { bpSys, bpDia, pulse, tempC10, spo2, weightG, heightMm, sugar, resp }.
  `CREATE TABLE IF NOT EXISTS visits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL,
    doctor_id INTEGER NOT NULL,
    at INTEGER NOT NULL,
    day TEXT NOT NULL,
    complaint TEXT NOT NULL DEFAULT '',
    history TEXT NOT NULL DEFAULT '',
    examination TEXT NOT NULL DEFAULT '',
    diagnosis TEXT NOT NULL DEFAULT '',
    plan TEXT NOT NULL DEFAULT '',
    vitals TEXT NOT NULL DEFAULT '{}',
    rx_notes TEXT NOT NULL DEFAULT '',
    follow_up TEXT NOT NULL DEFAULT '',
    created_by TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  "CREATE INDEX IF NOT EXISTS visits_patient ON visits (patient_id, at)",
  "CREATE INDEX IF NOT EXISTS visits_day ON visits (day)",
  `CREATE TABLE IF NOT EXISTS prescription_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    visit_id INTEGER NOT NULL,
    sort INTEGER NOT NULL DEFAULT 0,
    medicine TEXT NOT NULL,
    dose TEXT NOT NULL DEFAULT '',
    frequency TEXT NOT NULL DEFAULT '',
    duration TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT ''
  )`,
  "CREATE INDEX IF NOT EXISTS prescription_items_visit ON prescription_items (visit_id)",
  // The clinic's saved medicines, offered while writing a prescription.
  `CREATE TABLE IF NOT EXISTS medicines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    form TEXT NOT NULL DEFAULT '',
    dose TEXT NOT NULL DEFAULT '',
    frequency TEXT NOT NULL DEFAULT '',
    duration TEXT NOT NULL DEFAULT '',
    active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL
  )`,
  "CREATE UNIQUE INDEX IF NOT EXISTS medicines_name ON medicines (name COLLATE NOCASE)",
  // Lab tests and imaging asked for in a visit, and their results.
  `CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL,
    visit_id INTEGER,
    kind TEXT NOT NULL DEFAULT 'lab',
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ordered',
    result TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    done_at INTEGER
  )`,
  "CREATE INDEX IF NOT EXISTS orders_patient ON orders (patient_id)",
  // Lab results, X-rays and other documents (images are shrunk in the
  // browser first). The file itself is in patient_file_data, so listing
  // stays light.
  `CREATE TABLE IF NOT EXISTS patient_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL,
    visit_id INTEGER,
    kind TEXT NOT NULL DEFAULT 'other',
    title TEXT NOT NULL DEFAULT '',
    mime TEXT NOT NULL,
    size INTEGER NOT NULL,
    created_by TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL
  )`,
  "CREATE INDEX IF NOT EXISTS patient_files_patient ON patient_files (patient_id)",
  `CREATE TABLE IF NOT EXISTS patient_file_data (
    file_id INTEGER PRIMARY KEY,
    data BLOB NOT NULL
  )`,

  // ---- Money ----
  // Amounts are integer hundredths of the clinic's currency.
  `CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    sort INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  )`,
  // What a patient owes: a visit fee or a service.
  `CREATE TABLE IF NOT EXISTS charges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL,
    visit_id INTEGER,
    doctor_id INTEGER,
    service_id INTEGER,
    description TEXT NOT NULL,
    amount INTEGER NOT NULL,
    discount INTEGER NOT NULL DEFAULT 0,
    day TEXT NOT NULL,
    at INTEGER NOT NULL,
    created_by TEXT NOT NULL DEFAULT '',
    voided_at INTEGER
  )`,
  "CREATE INDEX IF NOT EXISTS charges_patient ON charges (patient_id)",
  "CREATE INDEX IF NOT EXISTS charges_day ON charges (day)",
  // Money received from a patient, set against their balance.
  `CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL,
    amount INTEGER NOT NULL,
    method TEXT NOT NULL DEFAULT 'cash',
    day TEXT NOT NULL,
    at INTEGER NOT NULL,
    created_by TEXT NOT NULL DEFAULT '',
    voided_at INTEGER
  )`,
  "CREATE INDEX IF NOT EXISTS payments_patient ON payments (patient_id)",
  "CREATE INDEX IF NOT EXISTS payments_day ON payments (day)",
  `CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    amount INTEGER NOT NULL,
    created_by TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    deleted_at INTEGER
  )`,
  "CREATE INDEX IF NOT EXISTS expenses_day ON expenses (day)",
];

// Columns added to tables after they first shipped: [table, column, definition].
export const ADDED_COLUMNS: [string, string, string][] = [
  // A doctor's working week and days off (JSON, lib/clinic.ts DoctorSchedule);
  // "" = the clinic's booking hours every day.
  ["doctors", "schedule", "TEXT NOT NULL DEFAULT ''"],
];

async function addMissingColumns(client: Client): Promise<void> {
  const tables = [...new Set(ADDED_COLUMNS.map(([table]) => table))];
  for (const table of tables) {
    const { rows } = await client.execute(`PRAGMA table_info(${table})`);
    const have = new Set(rows.map((r) => String(r.name)));
    for (const [t, column, definition] of ADDED_COLUMNS) {
      if (t === table && !have.has(column)) {
        try {
          await client.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
        } catch (err) {
          // Another server instance may have added it a moment ago.
          if (!String(err).includes("duplicate column")) throw err;
        }
      }
    }
  }
}

export async function setUp(client: Client): Promise<void> {
  await client.batch(SCHEMA, "write");
  await addMissingColumns(client);
}
