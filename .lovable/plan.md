## Goal

Make it trivial to get into the app and explore every screen with realistic content.

## 1. Pre-fill the first-admin form (`src/routes/auth.tsx`)

When the screen detects no admin exists and switches to register mode, initialize the form fields with demo values the user can still edit:

- Full name: `Demo Admin`
- Email: `admin@demo.local`
- Password: `admin123`

A small helper line under the heading: "Demo values pre-filled — edit if you like, then click Create account."

No change to login mode.

## 2. Relax password rules

- `src/routes/auth.tsx` — no client-side length check (Supabase still enforces its own minimum).
- `src/routes/_authenticated/change-password.tsx` — drop the 8-char gate to 6 chars so the demo password works on the forced change-password screen too.
- Lower Supabase Auth minimum password length to 6 via `supabase--configure_auth` so `admin123` is accepted on sign-up.

Note for the user: this is for testing; raise it again before going to production.

## 3. "Seed demo data" button on the dashboard

Add an admin-only card on `src/routes/_authenticated/dashboard.tsx` with a **Seed demo data** action. It calls a new authenticated server function `seedDemoData` in `src/lib/admin.functions.ts` that:

- Verifies the caller has `admin` role (via `has_role` RPC) — refuses otherwise.
- Is idempotent: checks for a marker job title (e.g. `Software Engineer (demo)`) and exits early if found.
- Inserts:
  - 3 job titles: `Software Engineer (demo)`, `Customer Support Rep (demo)`, `Sales Associate (demo)`
  - 4–5 competencies per job title (e.g. for Engineer: Code Quality, Problem Solving, Collaboration, Delivery, Testing)
  - 2 demo employees via Auth Admin API:
    - `supervisor@demo.local` / `demo1234` — role employee, job title Software Engineer, no supervisor
    - `report@demo.local` / `demo1234` — role employee, job title Software Engineer, supervisor = the first one (makes the first one a supervisor automatically since "supervisor" = has reports)
  - Both with `must_change_password: false` so you can log straight in.

Returns a summary `{ jobTitles, competencies, employees, credentials: [{email,password,role}] }` and the dashboard shows a toast + a small panel listing the demo credentials so the user can sign in as supervisor/employee to test the full evaluation → development-plan flow.

The button shows "Already seeded" and is disabled after a successful run (detected by the early-exit response).

## Technical notes

- `seedDemoData` uses `requireSupabaseAuth` middleware, then dynamic-imports `@/integrations/supabase/client.server` inside the handler for `auth.admin.createUser` and bulk inserts (consistent with existing `inviteEmployee`).
- All inserts use service role to bypass RLS for the seed; user-facing reads still go through normal RLS.
- No schema migration needed — uses existing `job_titles`, `competencies`, `profiles`, `user_roles` tables.

## Files touched

- `src/routes/auth.tsx` — pre-fill state, helper text, drop length check
- `src/routes/_authenticated/change-password.tsx` — lower min length to 6
- `src/lib/admin.functions.ts` — add `seedDemoData`
- `src/routes/_authenticated/dashboard.tsx` — admin-only seed card + credentials panel
- Supabase auth config — min password length 6

## Out of scope

- Always-visible Sign in / Register toggle (not selected).
- Removing the seed button automatically after demo (kept; idempotent server-side guard is enough).
