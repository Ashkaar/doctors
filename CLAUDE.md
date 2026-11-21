# Doctors

Appointments, queue, patient records, prescriptions, lab results, fees and
reports for clinics in Iraq and Kurdistan. The third app sold through Ariloo
(https://ariloo.app, repo Ashkaar/ariloo), after Restafe and Dukaloo
(Ashkaar/dukaloo, whose platform layer this app started from). Product id
`doctors`, live at https://doctors.ariloo.app/<clinic>. Never copy from or
push to the HelloCleaners repos. Never call Ariloo a company; say "for your
business", never "small business".

## Shipping changes

- Never push to `main`. Work on a `claude/<feature>` branch and open a pull
  request; the owner merges, and Vercel deploys production from the merge.
- Before every push, run `npm run check` (`tsc --noEmit`, `eslint .`,
  `vitest run`, `next build`); all must be clean.
- Test in the browser too, with the demo registry (README "Run it locally
  with demo data"), driven by Playwright: phone width, right-to-left Kurdish,
  dark mode, and the roles (doctor, nurse, reception). On the live site, only
  read-only checks; never create data there.
- Every feature ships with: texts in all 4 languages, a "What's new" entry
  (`lib/updates.ts` + `updates.items` in every dictionary) and a README update.
- Never commit secrets. New environment variables go in `.env.example` and the
  README, and the owner sets them in Vercel.

## Patient privacy (the owner's standing rule)

- Patient information lives only in the clinic's own database. Never in
  logs, analytics or emails. Server code logs errors only through
  `logError()` / `serverError()` (`lib/safeLog.ts`: kind and code, never the
  message). No analytics scripts. No patient data in URLs (search text stays
  in the request body or query of a fetch, never the address bar).
- Every patient record needs a staff login. What a login may see is decided
  in the data layer, not only in the screens: `ownPatientsFilter()` and the
  `clinical` level (`full` / `vitals` / `none`, from the role) in
  `lib/patientsDb.ts` and `lib/visitsDb.ts`. API routes use the guards in
  `lib/guards.ts` (`requireRecord`, `requirePatient`, `requireVisit`).
- Deleting and exporting patient records is owner only (`requireOwner`).
- The service worker (`public/sw.js`) must never cache pages, API answers or
  files.
- The waiting-room screen shows numbers, doctors and rooms only.

## Next.js 16

This Next.js has breaking changes from older versions. Read the relevant
guide in `node_modules/next/dist/docs/` before using an unfamiliar API.
`proxy.ts` replaces middleware. Cache Components and partial prefetching are
OFF on purpose: every page depends on the clinic and the signed-in user.

## Conventions

- Design "warm calm": warm surfaces, round shapes (`rounded-full` buttons,
  `rounded-2xl` cards with `shadow-soft`), Nunito + Vazirmatn. The clinic's
  colour from Ariloo replaces the `brand-*` scale (default teal `#0e7490`).
- Colours come only from the tokens in `app/globals.css`: `brand-*`,
  `accent-*` (warnings), `surface-*`, `paper-*` (printing), the semantic
  tokens (`background`, `card`, `primary`, `primary-soft`, `muted`, …), plus
  `red-*` for destructive actions. Never raw palette names.
- Right-to-left: logical classes only (`ms-`, `pe-`, `start-`, `text-start`…).
  Flip directional icons with `rtl:-scale-x-100`. Page grids need
  `grid-cols-1` so phones don't scroll sideways.
- Money is integer cents (hundredths of the clinic's currency); vitals are
  whole numbers (tenths of °C, grams, millimetres). No floats stored.
- Dates: format with `lib/format.ts`, never `toLocaleString`. Days are
  `YYYY-MM-DD` in the clinic's time zone.
- Server-only code starts with `import "server-only"`. Shared types and Zod
  schemas live in client-safe files (`lib/clinic.ts`, `lib/sections.ts`…).
- Plans: `lib/plans.ts` is the only place that maps plans to sections and
  features. Roles: `lib/sections.ts` (`CLINICAL_OF`, `ROLE_SECTIONS`).
- Database: tables are created in code (`lib/db/setup.ts`: `SCHEMA` and
  `ADDED_COLUMNS`), queried with Drizzle (`lib/db/schema.ts`). Change both;
  `tests/schema.test.ts` checks they agree. Never edit a shipped CREATE TABLE.
  A new clinic starts empty: no seed data (the demo scripts are local only).
- Translations: `lib/i18n/en.ts` is the source; `ku`, `ar`, `tr` are typed
  from it. Keep "Ariloo" in Latin letters. Western digits everywhere.
- New top-level paths go in `lib/appRoots.ts`, and Ariloo must be told so it
  can reserve them.
- Never write to Ariloo's database. If Doctors needs a new column or setting
  from Ariloo, say so; that change is made in the Ariloo project.
