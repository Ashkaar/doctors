// Fills the local demo clinic (city-clinic) with made-up patients, visits,
// appointments, fees and expenses, through the app's own API, for
// screenshots and trying things out. LOCAL DEMO ONLY: the app itself never
// adds sample data to a clinic.
//
// Needs the app running in many-clinic mode with the demo registry
// (see README "Run it locally with demo data"):
//   node scripts/demo/seed.mjs [http://localhost:3000]
import { createHmac } from "node:crypto";
import { createClient } from "@libsql/client";
import { resolve } from "node:path";

const base = (process.argv[2] || "http://localhost:3000").replace(/\/+$/, "");
const clinic = "city-clinic";
const secret = process.env.DOCTORS_SSO_SECRET || "demo-secret";
const ownerPassword = "demo-owner-1";
let cookies = {};

const cookieHeader = () => Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; ");
function keep(res) {
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const [pair] = c.split(";");
    const [k, v] = pair.split("=");
    if (v) cookies[k] = v;
    else delete cookies[k];
  }
}
async function call(method, path, body) {
  const res = await fetch(`${base}/${clinic}${path}`, {
    method,
    headers: { cookie: cookieHeader(), ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  keep(res);
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(data)}`);
  return data;
}

// Sign in as the owner, as "Open Doctors" on Ariloo does.
const expires = Date.now() + 50_000;
const token = `v1.${clinic}.${expires}.${createHmac("sha256", secret).update(`sso:${clinic}.${expires}`).digest("hex")}`;
const sso = await fetch(`${base}/${clinic}/api/auth/sso?token=${token}`, { redirect: "manual" });
keep(sso);
if (!cookies.doctors_session) throw new Error("Sign-in from Ariloo failed: is the app running with DOCTORS_SSO_SECRET=demo-secret and the demo registry?");
try {
  await call("POST", "/api/owner-password", { password: ownerPassword });
} catch {
  console.log("Owner password was already set; carrying on.");
}

const existing = await call("GET", "/api/patients?q=");
if (existing.patients.length > 0) {
  console.log("The demo clinic already has patients. Delete .demo/city-clinic.db to start again.");
  process.exit(0);
}

// Doctors and logins.
const sara = (await call("POST", "/api/doctors", { name: "Dr. Sara Ahmed", specialty: "Family medicine", room: "1", licence: "KRG-20931", shareBp: 5000, slotMinutes: 15 })).doctor;
const karwan = (await call("POST", "/api/doctors", { name: "Dr. Karwan Ali", specialty: "Paediatrics", room: "2", licence: "KRG-31877", shareBp: 4000, slotMinutes: 20 })).doctor;
const saraLogin = (await call("POST", "/api/staff", { name: "Sara", password: "sara-1234", role: "doctor", permissions: ["dashboard", "appointments", "queue", "patients", "medicines"] })).user;
await call("PATCH", `/api/doctors/${sara.id}`, { ...sara, staffId: saraLogin.id });
// Dr. Karwan works afternoons, Saturday to Thursday, with a conference next week.
const week = [[14 * 60, 20 * 60], [14 * 60, 20 * 60], [14 * 60, 20 * 60], [14 * 60, 20 * 60], [14 * 60, 20 * 60], null, [9 * 60, 20 * 60]];
const nextWeek = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
await call("PATCH", `/api/doctors/${karwan.id}`, { ...karwan, schedule: { week, off: [{ from: nextWeek, to: nextWeek, note: "Conference" }] } });
await call("POST", "/api/staff", { name: "Rezan", password: "rezan-1234", role: "reception", permissions: ["dashboard", "appointments", "queue", "patients", "payments"] });
await call("POST", "/api/staff", { name: "Hana", password: "hana-1234", role: "nurse", permissions: ["dashboard", "queue", "patients"] });

// Price list and medicines.
const consult = (await call("POST", "/api/services", { name: "Consultation", price: 25_000_00 })).service;
const follow = (await call("POST", "/api/services", { name: "Follow-up", price: 15_000_00 })).service;
const ecg = (await call("POST", "/api/services", { name: "ECG", price: 20_000_00 })).service;
await call("POST", "/api/services", { name: "Blood sugar test", price: 5_000_00 });
for (const m of [
  { name: "Amoxicillin 500 mg", form: "Capsule", dose: "1 capsule", frequency: "3 times a day", duration: "7 days" },
  { name: "Paracetamol 500 mg", form: "Tablet", dose: "1–2 tablets", frequency: "Every 6 hours if needed", duration: "3 days" },
  { name: "Metformin 500 mg", form: "Tablet", dose: "1 tablet", frequency: "Twice a day with food", duration: "3 months" },
  { name: "Amlodipine 5 mg", form: "Tablet", dose: "1 tablet", frequency: "Once a day", duration: "3 months" },
  { name: "Ibuprofen syrup 100 mg/5 ml", form: "Syrup", dose: "5 ml", frequency: "3 times a day", duration: "5 days" },
  { name: "Omeprazole 20 mg", form: "Capsule", dose: "1 capsule", frequency: "Before breakfast", duration: "4 weeks" },
]) await call("POST", "/api/medicines", m);

// Patients.
const people = [
  ["Ahmed Karim", "0750 412 3381", "m", "1992-03-14", "O+", "Penicillin", "Type 2 diabetes"],
  ["Lana Omer", "0751 908 2210", "f", "2018", "A+", "", ""],
  ["Hawre Jalal", "0770 145 0977", "m", "1965-07-02", "B+", "", "High blood pressure"],
  ["Shilan Aziz", "0750 330 1129", "f", "1999-12-20", "AB+", "", ""],
  ["Dilan Rashid", "0751 220 6402", "f", "1987-05-09", "O-", "Aspirin", "Asthma"],
  ["Karzan Hamad", "0770 881 5530", "m", "1978", "A-", "", ""],
  ["Zhyar Mahmood", "0750 676 2045", "m", "2021-02-11", "", "", ""],
  ["Nask Salih", "0751 004 7781", "f", "1995-08-30", "B-", "Sulfa drugs", ""],
  ["Rebin Faraj", "0770 512 9903", "m", "1958-01-17", "O+", "", "Heart disease"],
  ["Avin Qadir", "0750 263 4418", "f", "2010-10-05", "A+", "", ""],
];
const patients = [];
for (const [name, phone, gender, birthDate, bloodGroup, allergies, conditions] of people) {
  patients.push((await call("POST", "/api/patients", { name, phone, gender, birthDate, bloodGroup, allergies, conditions, address: "Erbil" })).patient);
}

// Today: appointments, the queue and visits.
const today = (await call("GET", "/api/queue")).day;
const slots = [
  [patients[0], sara, 9 * 60], [patients[2], sara, 9 * 60 + 15], [patients[3], sara, 9 * 60 + 30], [patients[4], sara, 10 * 60],
  [patients[1], karwan, 9 * 60 + 20], [patients[6], karwan, 9 * 60 + 40], [patients[9], karwan, 10 * 60 + 20],
  [patients[7], sara, 11 * 60 + 30], [patients[8], sara, 12 * 60], [patients[5], karwan, 12 * 60 + 40],
];
const appts = [];
for (const [p, d, start] of slots) appts.push((await call("POST", "/api/appointments", { patientId: p.id, doctorId: d.id, day: today, startMin: start, durationMin: d.slotMinutes, reason: ["Follow-up", "Fever", "Blood pressure check", "New patient", "Check-up"][appts.length % 5] })).appointment);

// Arrivals: the first six are here.
const tickets = [];
for (const a of appts.slice(0, 6)) tickets.push((await call("PATCH", `/api/appointments/${a.id}`, { status: "arrived" })).ticket);
// A walk-in.
tickets.push((await call("POST", "/api/queue", { patientId: patients[5].id, doctorId: sara.id })).ticket);

// Two patients already seen, one in the room with each doctor.
async function see(ticket, notes, items, fee) {
  const { id } = await call("POST", "/api/visits", { patientId: ticket.patientId, ticketId: ticket.id });
  await call("PATCH", `/api/visits/${id}`, notes);
  if (items) await call("PATCH", `/api/visits/${id}`, { items });
  if (fee) await call("POST", "/api/charges", { patientId: ticket.patientId, visitId: id, doctorId: ticket.doctorId, serviceId: fee.service.id, amount: fee.service.price, discount: fee.discount ?? 0, paid: fee.paid, method: fee.method ?? "cash" });
  return id;
}
await see(
  tickets[1],
  { vitals: { bpSys: 148, bpDia: 92, pulse: 78, tempC10: 368, weightG: 86000, heightMm: 1720 }, notes: { complaint: "Headaches in the morning for two weeks.", examination: "BP 148/92. Heart and lungs normal.", diagnosis: "Essential hypertension, not controlled", plan: "Start amlodipine. Less salt. Check BP at home.", followUp: "In 2 weeks" } },
  [{ medicine: "Amlodipine 5 mg", dose: "1 tablet", frequency: "Once a day", duration: "3 months", notes: "In the morning" }],
  { service: consult, paid: 25_000_00 },
);
await call("PATCH", `/api/queue/${tickets[1].id}`, { status: "done" });
await see(
  tickets[4],
  { vitals: { pulse: 112, tempC10: 389, weightG: 21500, spo2: 98 }, notes: { complaint: "Fever and sore throat since yesterday.", examination: "Red throat, swollen tonsils.", diagnosis: "Acute tonsillitis", plan: "Antibiotic, fluids, fever medicine.", followUp: "If not better in 3 days" } },
  [
    { medicine: "Amoxicillin 500 mg", dose: "250 mg", frequency: "3 times a day", duration: "7 days", notes: "" },
    { medicine: "Ibuprofen syrup 100 mg/5 ml", dose: "5 ml", frequency: "3 times a day", duration: "5 days", notes: "After food" },
  ],
  { service: consult, paid: 20_000_00, discount: 5_000_00 },
);
await call("PATCH", `/api/queue/${tickets[4].id}`, { status: "done" });
const inRoom = await see(tickets[0], { vitals: { bpSys: 128, bpDia: 82, pulse: 74, tempC10: 368, weightG: 82000, heightMm: 1780, sugar: 142 }, notes: { complaint: "Diabetes follow-up. Feels well.", history: "Type 2 diabetes for 5 years. On metformin.", diagnosis: "Type 2 diabetes, fairly controlled" } }, [
  { medicine: "Metformin 500 mg", dose: "1 tablet", frequency: "Twice a day with food", duration: "3 months", notes: "" },
]);
await call("POST", "/api/orders", { patientId: patients[0].id, visitId: inRoom, kind: "lab", name: "HbA1c" });
await call("POST", "/api/orders", { patientId: patients[0].id, visitId: inRoom, kind: "lab", name: "Kidney function (urea, creatinine)" });
await see(tickets[5], { vitals: { tempC10: 375, weightG: 14200 } });
await call("POST", "/api/queue/next", { doctorId: sara.id });
// Someone who owes.
await call("POST", "/api/charges", { patientId: patients[8].id, doctorId: sara.id, serviceId: ecg.id, amount: ecg.price, paid: 0 });
await call("POST", "/api/charges", { patientId: patients[8].id, doctorId: sara.id, serviceId: follow.id, amount: follow.price, paid: 5_000_00 });

// Past weeks: visits and fees, moved back in time directly in the demo
// database so Reports has history.
const db = createClient({ url: `file:${resolve(".demo/city-clinic.db")}` });
const dayMs = 24 * 60 * 60 * 1000;
const dayOf = (offset) => new Date(Date.now() - offset * dayMs).toISOString().slice(0, 10);
for (let back = 1; back <= 24; back++) {
  const n = 2 + ((back * 7) % 5);
  for (let i = 0; i < n; i++) {
    const p = patients[(back + i) % patients.length];
    const d = i % 3 === 0 ? karwan : sara;
    const s = [consult, follow, ecg][(back + i) % 3];
    const at = Date.now() - back * dayMs - i * 3600_000;
    const day = dayOf(back);
    const v = await db.execute({ sql: "INSERT INTO visits (patient_id, doctor_id, at, day, complaint, diagnosis, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)", args: [p.id, d.id, at, day, "Check-up", ["Upper respiratory infection", "Hypertension follow-up", "Gastritis", "Back pain", "Routine check-up"][(back + i) % 5], "owner", at, at] });
    await db.execute({ sql: "INSERT INTO charges (patient_id, visit_id, doctor_id, service_id, description, amount, discount, day, at, created_by) VALUES (?,?,?,?,?,?,?,?,?,?)", args: [p.id, Number(v.lastInsertRowid), d.id, s.id, s.name, s.price, 0, day, at, "Rezan"] });
    await db.execute({ sql: "INSERT INTO payments (patient_id, amount, method, day, at, created_by) VALUES (?,?,?,?,?,?)", args: [p.id, s.price, ["cash", "cash", "card", "transfer"][(back + i) % 4], day, at, "Rezan"] });
  }
}
for (const [back, category, description, amount] of [[3, "Rent", "November rent", 350_000_00], [6, "Supplies", "Gloves, syringes", 120_000_00], [10, "Salaries", "Part-time nurse", 300_000_00], [15, "Electricity", "Generator", 85_000_00], [1, "Lab", "Test strips", 40_000_00]]) {
  await call("POST", "/api/expenses", { day: dayOf(back), category, description, amount });
}

console.log(`Demo clinic ready at ${base}/${clinic}`);
console.log(`Owner password: ${ownerPassword} · staff: Sara (doctor) sara-1234, Rezan (reception) rezan-1234, Hana (nurse) hana-1234`);
