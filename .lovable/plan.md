## Goal
Restructure the app around four explicit roles — **Admin, HR, Supervisor, Employee** — with clear responsibilities, plus add quizzes and reporting.

## Roles & permissions

| Capability | Admin | HR | Supervisor | Employee |
|---|---|---|---|---|
| Manage roles (assign Admin/HR/Supervisor/Employee to any user) | ✅ | — | — | — |
| Create / edit employees (invite, reset password) | ✅ | — | — | — |
| Create / edit job titles | ✅ | ✅ | — | — |
| Assign job title to employee | ✅ | ✅ | — | — |
| Assign supervisor to employee | ✅ | ✅ | — | — |
| Create / edit competencies (per job title) | ✅ | ✅ | — | — |
| Review own competencies | ✅ | ✅ | ✅ | ✅ |
| Self-evaluate | ✅ | ✅ | ✅ | ✅ |
| Evaluate direct reports | — | — | ✅ | — |
| Create development plan for a report (when supervisor eval < 60%) | — | — | ✅ | — |
| Create quiz & assign to direct reports | — | — | ✅ | — |
| Take assigned quiz | ✅ | ✅ | ✅ | ✅ |
| View own development plan | ✅ | ✅ | ✅ | ✅ |
| Individual report (self) | ✅ | ✅ | ✅ | ✅ |
| Team report (own reports) | — | — | ✅ | — |
| Org-wide / general reports | ✅ | ✅ | — | — |

**Supervisor is derived**, not assigned: anyone with ≥1 row in `profiles.supervisor_id = me` automatically gets supervisor capabilities. Admin/HR/Employee are explicit roles in `user_roles`.

## Changes

### 1. Database
- Extend `app_role` enum: add `hr`. Keep `admin`, `employee`. (Supervisor stays derived.)
- New tables (all with GRANT + RLS):
  - `quizzes` (id, supervisor_id, title, description, created_at)
  - `quiz_questions` (id, quiz_id, prompt, order_index)
  - `quiz_choices` (id, question_id, text, is_correct, order_index)
  - `quiz_assignments` (id, quiz_id, employee_id, assigned_at, status)
  - `quiz_attempts` (id, assignment_id, score_pct, submitted_at)
  - `quiz_answers` (id, attempt_id, question_id, choice_id)
- Helper fn `public.is_hr(uuid)` mirroring `has_role`.
- RLS:
  - Job titles & competencies: admin OR hr can write; everyone authenticated can read.
  - Profiles: admin OR hr can update `job_title_id` and `supervisor_id`; only admin can change roles via `user_roles`.
  - Quizzes: supervisor owns; assigned employees can read their own assignment + submit attempts.

### 2. Server functions (`src/lib/admin.functions.ts` + new files)
- `setUserRoles({ userId, roles[] })` — admin-only; replaces user's rows in `user_roles`.
- `assignJobTitle`, `assignSupervisor` — admin or HR.
- `createQuiz`, `assignQuiz`, `submitQuizAttempt` — supervisor/employee scoped.
- `getIndividualReport(userId)`, `getTeamReport(supervisorId)`, `getOrgReport()` — role-gated.

### 3. UI / routes
- `src/lib/auth.ts`: expose `isAdmin`, `isHR`, `isSupervisor`, `isEmployee`.
- `src/components/AppShell.tsx`: rebuild sidebar grouped by role:
  - **Admin**: Employees, Roles, Job Titles, Competencies, Reports
  - **HR**: Job Titles, Competencies, Employees (assign job title/supervisor only), Reports
  - **Supervisor**: My Team, Evaluate, Development Plans, Quizzes, Team Report
  - **Everyone**: Dashboard, My Competencies, My Evaluations, My Development Plan, My Quizzes, My Report
- New routes:
  - `/_authenticated/admin/roles.tsx` — list users, multi-select role chips (Admin / HR / Employee), save.
  - `/_authenticated/hr/employees.tsx` — HR-scoped: assign job title & supervisor (no invite/role change).
  - `/_authenticated/supervisor/quizzes.tsx` + `quizzes.new.tsx` + `quizzes.$id.assign.tsx`
  - `/_authenticated/my-quizzes.tsx` + `my-quizzes.$assignmentId.tsx` (take quiz)
  - `/_authenticated/my-competencies.tsx` (read-only list for current job title)
  - `/_authenticated/reports/individual.tsx`, `reports/team.tsx`, `reports/org.tsx`
- Update existing admin pages to also allow HR where appropriate (job titles, competencies).

### 4. Reports (simple v1)
- Individual: own evaluations over time, latest score per competency, dev plan progress, quiz scores.
- Team: per-report status (last self %, last supervisor %, has dev plan, open dev plan items, quiz completion).
- Org: counts of employees per job title, average scores per job title, employees below 60%.

## Out of scope (v1)
- Quiz question types beyond single-choice multiple choice.
- Email notifications for quiz assignment (toast only).
- Export to PDF/CSV (on-screen tables + charts only).

## Technical notes
- All new tables follow the GRANT → RLS → POLICY pattern; service_role gets ALL, authenticated gets the minimum needed.
- Role checks in RLS use `has_role(auth.uid(), 'admin'|'hr')` + `is_supervisor_of(...)`.
- "Supervisor" never lives in `user_roles`; UI derives it from `profiles.supervisor_id` count, same as today.
- The first-admin bootstrap stays unchanged.

After you approve, I'll do it in two builds: (1) DB migration + role plumbing + sidebar, (2) quizzes + reports.
