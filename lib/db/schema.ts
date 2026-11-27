import { blob, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Each clinic's own database, as Drizzle sees it (for typed queries).
//
// The tables are created by lib/db/setup.ts (CREATE TABLE IF NOT EXISTS,
// plus ADDED_COLUMNS for later changes), not by a migration tool: there is
// one database per clinic, and each is set up on first use. A unit test
// (tests/schema.test.ts) checks that the two descriptions match.
//
// Conventions: money is an integer number of hundredths of the clinic's
// currency ("cents"); times are integer milliseconds since 1970; days are
// "YYYY-MM-DD" in the clinic's time zone.

export const clinicSecrets = sqliteTable("clinic_secrets", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const clinicSettings = sqliteTable("clinic_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const staff = sqliteTable("staff", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  role: text("role").notNull().default("reception"),
  passwordHash: text("password_hash").notNull(),
  permissions: text("permissions").notNull().default("[]"),
  ownPatientsOnly: integer("own_patients_only").notNull().default(0),
  active: integer("active").notNull().default(1),
  version: text("version").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const activityLog = sqliteTable("activity_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  at: integer("at").notNull(),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  detail: text("detail").notNull().default(""),
});

export const doctors = sqliteTable("doctors", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  specialty: text("specialty").notNull().default(""),
  phone: text("phone").notNull().default(""),
  licence: text("licence").notNull().default(""),
  room: text("room").notNull().default(""),
  staffId: integer("staff_id"),
  shareBp: integer("share_bp").notNull().default(0),
  slotMinutes: integer("slot_minutes").notNull().default(15),
  active: integer("active").notNull().default(1),
  createdAt: integer("created_at").notNull(),
  schedule: text("schedule").notNull().default(""),
});

export const patients = sqliteTable("patients", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fileNo: integer("file_no").notNull(),
  name: text("name").notNull(),
  phone: text("phone").notNull().default(""),
  gender: text("gender").notNull().default(""),
  birthDate: text("birth_date").notNull().default(""),
  bloodGroup: text("blood_group").notNull().default(""),
  allergies: text("allergies").notNull().default(""),
  conditions: text("conditions").notNull().default(""),
  address: text("address").notNull().default(""),
  notes: text("notes").notNull().default(""),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const appointments = sqliteTable("appointments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  patientId: integer("patient_id").notNull(),
  doctorId: integer("doctor_id").notNull(),
  day: text("day").notNull(),
  startMin: integer("start_min").notNull(),
  durationMin: integer("duration_min").notNull().default(15),
  status: text("status").notNull().default("booked"),
  reason: text("reason").notNull().default(""),
  createdBy: text("created_by").notNull().default(""),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const queue = sqliteTable("queue", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  day: text("day").notNull(),
  number: integer("number").notNull(),
  patientId: integer("patient_id").notNull(),
  doctorId: integer("doctor_id").notNull(),
  appointmentId: integer("appointment_id"),
  visitId: integer("visit_id"),
  status: text("status").notNull().default("waiting"),
  calledAt: integer("called_at"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const visits = sqliteTable("visits", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  patientId: integer("patient_id").notNull(),
  doctorId: integer("doctor_id").notNull(),
  at: integer("at").notNull(),
  day: text("day").notNull(),
  complaint: text("complaint").notNull().default(""),
  history: text("history").notNull().default(""),
  examination: text("examination").notNull().default(""),
  diagnosis: text("diagnosis").notNull().default(""),
  plan: text("plan").notNull().default(""),
  vitals: text("vitals").notNull().default("{}"),
  rxNotes: text("rx_notes").notNull().default(""),
  followUp: text("follow_up").notNull().default(""),
  createdBy: text("created_by").notNull().default(""),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const prescriptionItems = sqliteTable("prescription_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  visitId: integer("visit_id").notNull(),
  sort: integer("sort").notNull().default(0),
  medicine: text("medicine").notNull(),
  dose: text("dose").notNull().default(""),
  frequency: text("frequency").notNull().default(""),
  duration: text("duration").notNull().default(""),
  notes: text("notes").notNull().default(""),
});

export const medicines = sqliteTable("medicines", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  form: text("form").notNull().default(""),
  dose: text("dose").notNull().default(""),
  frequency: text("frequency").notNull().default(""),
  duration: text("duration").notNull().default(""),
  active: integer("active").notNull().default(1),
  createdAt: integer("created_at").notNull(),
});

export const orders = sqliteTable("orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  patientId: integer("patient_id").notNull(),
  visitId: integer("visit_id"),
  kind: text("kind").notNull().default("lab"),
  name: text("name").notNull(),
  status: text("status").notNull().default("ordered"),
  result: text("result").notNull().default(""),
  createdAt: integer("created_at").notNull(),
  doneAt: integer("done_at"),
});

export const patientFiles = sqliteTable("patient_files", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  patientId: integer("patient_id").notNull(),
  visitId: integer("visit_id"),
  kind: text("kind").notNull().default("other"),
  title: text("title").notNull().default(""),
  mime: text("mime").notNull(),
  size: integer("size").notNull(),
  createdBy: text("created_by").notNull().default(""),
  createdAt: integer("created_at").notNull(),
});

export const patientFileData = sqliteTable("patient_file_data", {
  fileId: integer("file_id").primaryKey(),
  data: blob("data", { mode: "buffer" }).notNull(),
});

export const services = sqliteTable("services", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  price: integer("price").notNull().default(0),
  active: integer("active").notNull().default(1),
  sort: integer("sort").notNull().default(0),
  createdAt: integer("created_at").notNull(),
});

export const charges = sqliteTable("charges", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  patientId: integer("patient_id").notNull(),
  visitId: integer("visit_id"),
  doctorId: integer("doctor_id"),
  serviceId: integer("service_id"),
  description: text("description").notNull(),
  amount: integer("amount").notNull(),
  discount: integer("discount").notNull().default(0),
  day: text("day").notNull(),
  at: integer("at").notNull(),
  createdBy: text("created_by").notNull().default(""),
  voidedAt: integer("voided_at"),
});

export const payments = sqliteTable("payments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  patientId: integer("patient_id").notNull(),
  amount: integer("amount").notNull(),
  method: text("method").notNull().default("cash"),
  day: text("day").notNull(),
  at: integer("at").notNull(),
  createdBy: text("created_by").notNull().default(""),
  voidedAt: integer("voided_at"),
});

export const expenses = sqliteTable("expenses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  day: text("day").notNull(),
  category: text("category").notNull().default(""),
  description: text("description").notNull().default(""),
  amount: integer("amount").notNull(),
  createdBy: text("created_by").notNull().default(""),
  createdAt: integer("created_at").notNull(),
  deletedAt: integer("deleted_at"),
});

export const dentalTeeth = sqliteTable("dental_teeth", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  patientId: integer("patient_id").notNull(),
  tooth: integer("tooth").notNull(),
  conditions: text("conditions").notNull().default("[]"),
  surfaces: text("surfaces").notNull().default("{}"),
  note: text("note").notNull().default(""),
  updatedAt: integer("updated_at").notNull(),
});

export const dentalWork = sqliteTable("dental_work", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  patientId: integer("patient_id").notNull(),
  visitId: integer("visit_id"),
  tooth: integer("tooth"),
  procedure: text("procedure").notNull(),
  surfaces: text("surfaces").notNull().default("[]"),
  status: text("status").notNull().default("planned"),
  fee: integer("fee").notNull().default(0),
  note: text("note").notNull().default(""),
  chargeId: integer("charge_id"),
  createdBy: text("created_by").notNull().default(""),
  createdAt: integer("created_at").notNull(),
  doneAt: integer("done_at"),
});

export const eyeExams = sqliteTable("eye_exams", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  visitId: integer("visit_id").notNull(),
  patientId: integer("patient_id").notNull(),
  data: text("data").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const vaccinations = sqliteTable("vaccinations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  patientId: integer("patient_id").notNull(),
  vaccine: text("vaccine").notNull(),
  givenOn: text("given_on").notNull(),
  batch: text("batch").notNull().default(""),
  note: text("note").notNull().default(""),
  createdBy: text("created_by").notNull().default(""),
  createdAt: integer("created_at").notNull(),
});

export const pregnancies = sqliteTable("pregnancies", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  patientId: integer("patient_id").notNull(),
  lmp: text("lmp").notNull(),
  edd: text("edd").notNull(),
  gravida: integer("gravida"),
  para: integer("para"),
  status: text("status").notNull().default("active"),
  endedOn: text("ended_on").notNull().default(""),
  outcome: text("outcome").notNull().default(""),
  notes: text("notes").notNull().default(""),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const ancChecks = sqliteTable("anc_checks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  pregnancyId: integer("pregnancy_id").notNull(),
  patientId: integer("patient_id").notNull(),
  visitId: integer("visit_id"),
  day: text("day").notNull(),
  weightG: integer("weight_g"),
  bpSys: integer("bp_sys"),
  bpDia: integer("bp_dia"),
  fhr: integer("fhr"),
  fundalCm: integer("fundal_cm"),
  presentation: text("presentation").notNull().default(""),
  notes: text("notes").notNull().default(""),
  createdAt: integer("created_at").notNull(),
});
