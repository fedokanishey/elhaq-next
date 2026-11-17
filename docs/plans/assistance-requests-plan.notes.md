# Assistance Requests Implementation Notes

## Deviations

- Plan originally named `vitest` (`Step 1`), with an explicit fallback plan in `Step 1R` when `npm install -D vitest` hit a peer conflict (`vitest@5.1.0` requires `@types/node@^22.0.0` while repo pins `@types/node@20.19.25`) and `vitest@^4.0.0` hit an npm arborist `edgesOut` error.
  - Code / Environment forced: Avoided mutating `@types/node` or forcing peer deps.
  - Taken: Implemented the Step 1R plan decision — native Node 22 `node:test` + `node:assert/strict` + `--experimental-strip-types` with `scripts/test-register.mjs` (`module.registerHooks` mapping `@/*` and extensionless TS imports to `format: "module-typescript"`), and verified all tests passing cleanly.
- Kept existing `canAccessDashboard = role === "admin"` line in `src/app/page.tsx` untouched to respect no-unrelated-refactor rule; `src/components/Navbar.tsx` and `/admin/assistance-requests` + `/api/admin/assistance-requests/*` properly authorize both `admin` and `superadmin` (`isAdmin = role === "admin" || isSuperAdmin`).
- Post-review hardening (`tidy` pass): added `requireAdminForRequestDocument` in `src/lib/assistance/admin-queries.ts` to protect unassigned (`branch: null`) documents from non-ZARQA branch admins, removed all 17 ESLint `no-explicit-any` errors in new assistance modules/routes, strengthened Cloudinary attachment URL parsing (`new URL` hostname & protocol verification), and updated `/admin/assistance-requests/[id]` beneficiary search placeholder so National IDs are never entered into GET query strings.
- Follow-up user requirements applied:
  1. Restricted `استبيان طلب مساعدة` (`/assistance-request` + `/api/assistance-requests` + navigation links) strictly to regular `user` accounts (`role === "user"`), with self-service branch selection in `/profile` (`PATCH /api/users`) and branch-scoped beneficiary verification + request routing so every request goes exclusively to the chosen branch's admin.
  2. Enabled read-only access for committee `member` (`عضو`) on `/admin/assistance-requests` and `/admin/assistance-requests/[id]` scoped strictly to their assigned branch (`evaluateAssistanceReadAccess`), while blocking all edits/deletes in both UI and APIs (`admin` same-branch and `superadmin` only).
  3. Added `DELETE /api/admin/assistance-requests/[id]` + permanent Delete buttons with confirmation dialogs in both `/admin/assistance-requests` and `/admin/assistance-requests/[id]` for admins/superadmins.

## How the run ended

Completed on real repository paths across database models/indexes, server verification & history engines, privacy/security controls, profile branch selection & user-only questionnaire UI, read-only member + full-management admin requests & detail review pages with permanent delete, automated tests (`npm test`), TypeScript check (`npx tsc --noEmit`), targeted ESLint check, and Next.js production build (`npm run build`).
