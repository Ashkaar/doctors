# Doctors

Appointments, the waiting-room queue, patient records, prescriptions, lab
results, fees and reports for doctors and clinics in Iraq and Kurdistan. It
runs in the browser on phones, tablets and computers, and installs as an app.

Doctors is the third app sold through [Ariloo](https://ariloo.app), after
Restafe and Dukaloo. One deployment serves every clinic, each at its own
address (`https://doctors.ariloo.app/<clinic>/…`) with its own database. It
speaks English, Kurdish (Sorani, right to left), Arabic (right to left) and
Turkish, in light and dark mode ("warm calm" design; each clinic's own
colour from Ariloo).

## What's in it

| Area | Status |
| --- | --- |
| Many clinics, Ariloo sign-in ("Open Doctors"), plans, closed-clinic and "payment overdue" pages | Done |
| Owner password, staff logins with roles (doctor, nurse, reception) and per-screen access, owner unlock on shared devices | Done |
| Today: waiting, seen, booked, fees, the queue now, up next | Done |
| Doctors: specialty, room, licence, appointment length, linked login, income share | Done |
| Doctors' working weeks and days off: free times follow them, booking outside them warns | Done |
| Appointments: day view per doctor, free slots, book, move, arrived (joins the queue), seen, no-show, cancel | Done |
| Queue: numbered turns per day, walk-ins, call next, see now, done/left; refreshes every 10 s | Done |
| Waiting-room screen (TV/tablet): numbers, doctor and room only, chime on a new call | Done |
| Patients: file number, search by name/phone/file, details, medical alerts (allergies, conditions), warning when a new patient may already have a file | Done |
| Visits: vitals (with BMI), complaint, history, examination, diagnosis, plan, follow-up | Done |
| Prescriptions from saved medicines, printed on A5 or A4 with the clinic's logo | Done |
| Lab and imaging orders with results; lab sheets, X-rays and PDFs on the patient's file | Done |
| Fees from a price list, discounts, part payments, balances owed, cash/card/transfer | Done |
| Printed receipts per patient and day (A5/A4, nothing medical on them) | Done |
| Kind of clinic (asked on the owner's first open, changeable in Settings): general, dental, eye, children, women's health | Done |
| Dental: interactive tooth chart (FDI, adult / mixed / baby teeth), conditions per tooth and surface, treatment plan with fees that can go straight to the patient's fees | Done |
| Eye: exam per visit for each eye (vision, refraction, pressure, front and back of the eye), history, printed glasses prescription | Done |
| Children: WHO growth charts 0–5 years (weight, length/height, head size, percentiles) from visit vitals, vaccine checklist | Done |
| Women's health: pregnancy record (due date from last period or scan, weeks pregnant, G/P), antenatal checks, past pregnancies | Done |
| Expenses by month and category | Done |
| Reports: fees, received, expenses, doctors' shares, net, by doctor/service/day/method | Done |
| Owner export (JSON, CSV) on every plan, one patient's full record, deleting a patient | Done |
| Activity log for the owner: who signed in and who opened, changed, deleted or exported which record | Done |
| Leaving a visit with unsaved changes asks first (closing the tab and links inside the app) | Done |
| Installable app (PWA) | Done |
| SMS / WhatsApp reminders, online booking for patients | Not planned yet |

## Plans

`lib/plans.ts` is the only place plans are mapped to screens and features.
A 7-day trial has everything.

- **Starter**: Today, appointments, queue and waiting-room screen, patients
  with visit notes and vitals, fees, payments and receipts, doctors'
  working hours, staff logins and the activity log, one doctor.
- **Pro**: everything in Starter, plus prescriptions (printed, with saved
  medicines), lab and imaging orders with results and files, expenses, and
  several doctors.
- **Advanced**: everything in Pro, plus reports and doctors' income shares.

Every plan lets the owner export all of the clinic's records: they belong to
the clinic. The charts for the clinic's kind (dental, eye, children, women's
health) are in every plan too: they are how that clinic works.

## Kinds of clinic and their charts

The first time the owner opens the clinic, Doctors asks what kind of clinic
it is (`clinic_types` in the clinic's settings; Ariloo isn't involved). The
answer decides which tabs patient files show and which charts visits show
(`lib/specialties.ts`, `lib/specialtiesDb.ts`, `components/specialties/`):

- **Dental**: the tooth chart and treatment plan (doctors, full record).
- **Eye**: the eye exam in each visit and its glasses prescription.
- **Children**: growth charts from the weight, height and head size recorded
  in visits, and vaccines (nurses may record vaccines). Growth curves are the
  WHO Child Growth Standards for 0–5 years, built by
  `scripts/who-growth/make.mjs` from the WHO's own tables
  (github.com/WorldHealthOrganization/anthro). The vaccine list is a common
  childhood schedule: check it against the Ministry of Health's current one.
- **Women's health**: pregnancy records with antenatal checks.

In a clinic of several kinds, each chart in a visit starts folded unless
the visit already uses it.

## Privacy

Patient information is sensitive, so:

- It lives only in the clinic's own database. Nothing about patients is sent
  to analytics (there is none), email or logs: server errors log only the
  error's kind and code (`lib/safeLog.ts`), never its message, which can hold
  query values. Patient search text never goes into the address bar.
- Every patient record needs a staff login. The role decides how much of the
  record is sent (`lib/patientsDb.ts`, `lib/visitsDb.ts`): reception gets no
  allergies, conditions or visit notes; nurses get vitals and alerts only; a
  doctor can be limited to their own patients.
- Deleting a patient and exporting records are for the owner only.
- The service worker keeps only the app's own files, never pages or data,
  so nothing is left on a shared device. Pages can't be framed and send no
  referrer. Uploaded files are checked by their first bytes.
- The waiting-room screen needs a secret key in its address and shows
  numbers, doctors and rooms only.
- The owner's activity log in the clinic's database notes who opened,
  changed, deleted or exported which record (by number, never medical text).

## Stack

- Next.js 16 (App Router, `proxy.ts`), React 19, TypeScript (strict)
- Tailwind CSS v4 with the colour tokens in `app/globals.css`;
  shadcn/ui-style components on Radix (`components/ui/`), lucide icons,
  sonner toasts; Nunito and Vazirmatn
- Turso (libSQL) via `@libsql/client`, queried with Drizzle ORM; Zod for
  validation shared by browser and server
- Vercel, functions in Dublin (`dub1`, next to Turso `aws-eu-west-1`)
- Vitest for unit tests, Playwright for browser checks

## Environment variables

Set these in the Vercel project (Production). Never commit them.

| Name | Purpose |
| --- | --- |
| `ARILOO_DB_URL`, `ARILOO_DB_TOKEN` | Ariloo's database, with a **read-only** token. Setting both turns many-clinic mode on. Doctors reads `ariloo_shops` rows with `product = 'doctors'` and never writes to it. |
| `SHOPS_DB_TOKEN` | A Turso group token that opens every clinic's own database (`db_url` in Ariloo). |
| `DOCTORS_SSO_SECRET` | Shared with Ariloo; checks the one-minute "Open Doctors" link. |
| `ARILOO_URL` | Where Ariloo lives, for clinic logos and account links. Default `https://ariloo.app`. |
| `DB_TURSO_DATABASE_URL`, `DB_TURSO_AUTH_TOKEN`, `OWNER_PASSWORD`, `SHOP_NAME`, `SHOP_CURRENCY`, `SHOP_DECIMALS`, `SHOP_LANG` | Single-clinic mode only (local development without Ariloo). |

## Many clinics

`proxy.ts` reads the first path segment as the clinic's address and passes
it on in a header only it can set; `lib/tenant.ts` reads that clinic's row
from Ariloo (cached 30 s) and works out its state (`lib/shopState.ts`):

- waiting: no database and no trial yet → "not open yet";
- trial: until `trial_ends_at`, every feature;
- active: until `paid_until`, the paid plan;
- grace: 5 more days, the paid plan, with a "payment overdue" banner;
- expired, or `suspended = 1` → closed, with a link to Ariloo.

Each clinic's tables are created on first use in its own database
(`lib/db/setup.ts`); a new clinic starts empty.

**Sign-in from Ariloo:** `GET /<clinic>/api/auth/sso?token=v1.<clinic>.<expires>.<hmac>`,
hmac = HMAC-SHA256 hex of `sso:<clinic>.<expires>` with `DOCTORS_SSO_SECRET`,
valid for 60 seconds, checked with `timingSafeEqual` (`lib/sso.ts`).
`expires` may be in milliseconds or seconds (Ariloo's current links use
seconds). The owner then chooses a fallback owner password.

**Reserved paths** (`lib/appRoots.ts`; Ariloo must refuse them as clinic
addresses): `api`, `dashboard`, `login`, `owner-password`, `screen`,
`sw.js`, `offline.html`, `manifest.webmanifest`, `icon`, `apple-icon`, plus
the files `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`,
`apple-touch-icon.png`, `favicon.ico`.

## Run it locally with demo data

```bash
npm install
npm run build
node scripts/demo/registry.mjs
```

```bash
ARILOO_DB_URL=file:.demo/ariloo.db ARILOO_DB_TOKEN=local SHOPS_DB_TOKEN=local DOCTORS_SSO_SECRET=demo-secret npx next start
```

Then, in another terminal:

```bash
node scripts/demo/seed.mjs http://localhost:3000
```

`registry.mjs` makes a stand-in Ariloo database with three clinics:
`city-clinic` (trial; filled by `seed.mjs` with two doctors, ten patients,
today's appointments and queue, visits, prescriptions, lab orders, fees and
24 days of history; Dr. Karwan works Saturday to Thursday with a day off
next week; all five kinds of clinic: a tooth chart for Ahmed, an eye exam for
Hawre, a baby (Mina) with growth and vaccines, and Shilan 24 weeks pregnant), `late-clinic` (Starter plan, payment overdue) and
`closed-clinic` (expired). Open http://localhost:3000/city-clinic and sign
in as Owner (`demo-owner-1`), Sara (doctor, `sara-1234`), Rezan (reception,
`rezan-1234`) or Hana (nurse, `hana-1234`). Delete `.demo/` to start again.
The demo data is made only by these scripts; the app itself never adds
sample data.

Without Ariloo at all: `cp .env.example .env.local`, `npm run dev`, and sign
in as Owner with `OWNER_PASSWORD` (single-clinic mode, every feature on).

`npm run check` runs everything a pull request must pass: type check, lint,
unit tests and a production build.

## Screens worth a screenshot

Show each on the device it is used on:

| Screen | Path | Device |
| --- | --- | --- |
| Today | `/dashboard` | laptop |
| Queue | `/dashboard/queue` | tablet |
| Waiting-room screen | `/screen?key=…` (Settings → Waiting-room screen) | TV / desktop |
| Appointments | `/dashboard/appointments` | tablet or laptop |
| Patient file | `/dashboard/patients/1` | laptop |
| Visit with vitals and prescription | `/dashboard/visits/<id>` | laptop or tablet |
| Printed prescription (A5) | `/dashboard/visits/<id>/print` | paper / desktop |
| Fees | `/dashboard/payments` | desktop |
| Reports | `/dashboard/reports` | desktop |
| Queue and Today on a phone | `/dashboard/queue`, `/dashboard` | phone |
| Staff roles | `/dashboard/staff` → Add staff | laptop |
| Doctor's working hours | `/dashboard/doctors` → calendar button | laptop |
| Receipt | `/dashboard/patients/<id>/receipt` | paper / desktop |
| Tooth chart with a tooth selected | `/dashboard/patients/1` (Teeth) | tablet |
| Eye exam in a visit, glasses prescription | `/dashboard/visits/<id>`, `…/glasses` | desktop / paper |
| Growth chart and vaccines | `/dashboard/patients/11` (Growth) | laptop |
| Pregnancy record | `/dashboard/patients/4` (Pregnancy) | tablet |
