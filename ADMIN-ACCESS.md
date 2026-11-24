# User access management

Scope: two roles for the existing authorized accounts. `member` can read all
analysis pages, run simulations, and download data. `super_admin` also manages
roles and activation status at `/pengguna`. Creating Auth accounts and resetting
passwords remain in Supabase Auth.

The admin API uses the single-segment `/api/admin-users` path supported by the
existing Vercel Python function routing. A nested `/api/admin/users` URL is
handled by Next.js as 404 on this deployment setup.

## UI direction

Reading this as an administration view for the group and lecturer in the existing
forest green dashboard. ENERGY 2 / RHYTHM 3 / MOTION 2, inherited from DESIGN.md.

- A searchable table makes names, NIM, role, and status comparable without repeating account cards.
- The editor appears above the list, focuses on opening, and returns focus to its trigger when closed, keeping one account in scope.
- Manrope and existing green controls preserve the dashboard identity; visible status text accompanies colored dots.
- A 16px form gap groups related fields; the existing panel spacing separates account editing, directory, and audit history.
- The admin icon combines a user and shield to identify access management. No invented avatars or illustrations are added.
- Motion uses the existing route transition and button feedback, with reduced motion inherited. No looping animation is added to account management.

## Authorization

`auth.py` verifies the Supabase session and server roster, then reads current role
and active status from `dashboard_users` using the caller's JWT. The server does
not use editable Auth metadata or browser role flags. Missing profiles and failed
database reads do not fall back to environment roles.

RLS exposes a user's own profile; active super admins can read the directory
and access log. Table writes are revoked from clients. The public RPC wrapper
runs as the caller; its private implementation checks the actor again after
acquiring a transaction lock. It validates role/status, rejects self-demotion and
self-deactivation, preserves an active admin, detects outdated versions, and
logs changes atomically. No service key is required.

## Verification

- PASS API: nine Python tests cover anonymous access, member rejection, forged payloads, current database roles, revoked accounts, and unchanged simulation permission.
- PASS database: rollback-only SQL tests cover member RLS, denied direct writes, rejected escalation, admin updates, audit records, stale versions, self-protection, and inactive admins.
- PASS build: Next.js production build, TypeScript, and ESLint complete successfully.
- Database advisor: no RLS or exposed security-definer findings for this change. Existing [leaked password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) is disabled; this change does not alter password policy.

Migration filenames match the versions returned by the connected Supabase
project after applying each migration through MCP.
