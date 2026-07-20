# Mentor Registration — Design

**Date:** 2026-07-20
**Status:** Approved for planning

## Overview

Mentors cannot self-register. A super admin creates the account; the mentor
receives an invitation email and activates it by setting their own password.
The account exists in a `pending` state from creation until activation, and
cannot be used to log in during that window.

## Decisions

| Decision | Choice | Rationale |
| --- | --- | --- |
| Create request body | `{ nume, email, telefon? }` | Mirrors the Individual body minus `password` and `acordTermeniSiConditii`, neither of which the super admin can meaningfully supply on the mentor's behalf. |
| Account state | New `status` enum on the user content-type | `confirmed` belongs to the users-permissions plugin and means "email verified", not "has set a password". Overloading it would leave no field for real email verification later. |
| Authorization | `global::is-super-admin` policy | First admin-gated route in the codebase; establishes a reusable pattern. |
| Invite token | Signed JWT stored in `resetPasswordToken` | Self-encodes expiry, so no new column. Storing it makes the token single-use. |
| Temporary password | 32 random bytes, hashed, never emailed | The account is never password-less, but no usable credential exists in anyone's inbox. |
| Recovery | Super-admin resend endpoint | Lapsed invites otherwise require manual database intervention. |
| Route permissions | Granted in `bootstrap` | Keeps grants in git and reproducible across environments rather than living only in the database. |

### Correction made during design

Strapi does **not** block unconfirmed logins by default. The check in
`plugin-users-permissions/dist/server/index.js:3646` is gated behind the
`email_confirmation` advanced setting, which is off. This is why the design
uses an explicit `status` field plus an own login override, rather than
relying on `confirmed`.

### Pre-existing bugs found during implementation

Both broke login for every account in the project, independently of this
feature.

1. **Missing `username` column.** The custom user schema dropped `username`,
   but the plugin's login handler queries `email OR username`, so
   `POST /api/auth/local` failed with a SQL error for all users. Fixed by
   re-adding `username` as optional and unique, mirroring `email`. It is left
   unpopulated; `required: true` would break the existing NGO and Individual
   flows, which do not supply one.

2. **Missing `provider` value.** The login query filters `provider = 'local'`,
   but `createNgo` and `createIndividual` never set it, leaving it NULL so no
   user matched. All three create flows now set `provider: "local"`, verified
   by registering and logging in through each endpoint.

   Rows created before this fix still hold NULL and cannot log in. At the time
   of writing there were 3 such users; they need a one-off
   `UPDATE up_users SET provider = 'local' WHERE provider IS NULL`, which has
   **not** been run.

## Schema change

`src/extensions/users-permissions/content-types/user/schema.json`

```json
"status": {
  "type": "enumeration",
  "enum": ["pending", "active", "deleted"],
  "default": "active",
  "required": true
}
```

Existing rows take the default, so there is no backfill and the NGO and
Individual flows need no changes. `deleted` is reserved for a future soft
delete; nothing sets it in this feature, but the login override rejects it
from day one.

`blocked` is not used by this feature and stays `false` throughout.

## Endpoints

| Method | Path | Auth | Body |
| --- | --- | --- | --- |
| `POST` | `/auth/register/mentor` | super-admin | `{ nume, email, telefon? }` |
| `POST` | `/auth/register/mentor/:id/resend` | super-admin | — |
| `POST` | `/auth/mentor/activate` | public (`auth: false`) | `{ token, password }` |

### Create

1. Validate with `registerMentorSchema` — same `nume` / `email` / `telefon`
   rules as `registerIndividualSchema`, including the async email-uniqueness
   refine.
2. Look up the `mentor` role; throw if absent, matching `createIndividual`.
3. In a transaction:
   - `user.add({ nume, email, telefon, password: randomBytes(32).toString("hex"), status: "pending", confirmed: true, blocked: false, role: role.id })`
   - Sign a JWT `{ id, purpose: "mentor-activation" }` with `JWT_SECRET`,
     `expiresIn` from `MENTOR_ACTIVATION_TTL` (default `7d`)
   - `user.edit(id, { resetPasswordToken: token })`
4. Send the invitation email.
5. Respond `{ message, id, status }` — the `id` is required for resend, since
   no mentor-listing endpoint exists yet.

Passwords are hashed by the plugin's `ensureHashedPasswords`
(`index.js:1785`), which applies to both `add` and `edit`. No manual bcrypt.

### Activate

Verification order, all failures returning the same generic Romanian message
so the endpoint cannot be used to probe token or account state:

1. `jwt.verify` — catches expiry and tampering
2. `payload.purpose === "mentor-activation"` — a login JWT cannot be replayed
3. User exists, role is `mentor`, `status === "pending"`
4. `user.resetPasswordToken === token` — enforces single use

Then `user.edit(id, { password, status: "active", resetPasswordToken: null })`.

`password` reuses the Individual rules: min 8, one uppercase, one digit, one
special character.

### Resend

Super-admin only. Rejects unless the target's role is `mentor` and `status`
is `pending`. Signs a fresh JWT and overwrites `resetPasswordToken`, which
silently invalidates the previous link.

## Bootstrap permissions

Custom routes with auth enabled are subject to the users-permissions
permission check, so the policy alone is not sufficient — a fresh database
returns 403 before the policy runs.

Add `ensureRolePermissions` alongside the existing `ensureAppRoles` in
`src/index.ts`, idempotent in the same way, granting the `super-admin` role:

- `api::auth.auth.registerMentor`
- `api::auth.auth.resendMentorInvite`

The activation route uses `config: { auth: false }`, consistent with the
existing NGO and Individual registration routes, so it needs no grant.

## Login override

`src/extensions/users-permissions/strapi-server.ts` is currently an empty
passthrough whose stated purpose is custom auth logic.

The plugin exports controllers as **factories**
(`auth = ({ strapi }) => ({ async callback (ctx) { … } })`), not as plain
objects. Assigning to `plugin.controllers.auth.callback` therefore sets a
property on the factory function that nothing ever calls — it fails silently,
loading correctly while having no effect. The extension must wrap the factory
and patch the controller it returns.

The wrapper runs **after** the plugin has verified credentials, rejecting any
user whose `status` is not `active` with:

> Contul tău nu este activat. Verifică emailul primit.

Checking state only after credentials are validated means the endpoint leaks
nothing about account existence to an unauthenticated caller.

## Email

`@strapi/provider-email-nodemailer`, configured in `config/plugins.ts` from
env. Auth is included only when `SMTP_USERNAME` is set, so one config serves
both Mailpit (which rejects an AUTH handshake) and production SMTP.

Sending is wrapped in `src/api/email/services/email.ts`
(`sendMentorActivation({ to, nume, link })`) so controllers never touch
`strapi.plugin("email")` directly — password resets and NGO notifications will
reuse it.

Activation link: `${FRONTEND_URL}/mentor/activare?token=<jwt>`

### Environment

```ini
SMTP_HOST=localhost
SMTP_PORT=1025
EMAIL_FROM=noreply@crestem-ong.local
EMAIL_REPLY_TO=noreply@crestem-ong.local
FRONTEND_URL=http://localhost:1337
MENTOR_ACTIVATION_TTL=7d
```

Already applied: provider installed, `config/plugins.ts` wired, and every key
above except `MENTOR_ACTIVATION_TTL`, which is added during implementation.

Delivery to Mailpit was verified directly over SMTP using these exact
transport options. Delivery *through Strapi* remains unverified, since that
requires a Strapi boot against the database.

## Files

```
src/policies/is-super-admin.ts                    NEW
src/api/email/services/email.ts                   NEW
src/api/auth/validation/auth.ts                   MOD  + registerMentorSchema, activateMentorSchema
src/api/auth/interfaces/auth.ts                   MOD  + MentorActivatePayload (fixes broken import)
src/api/auth/services/auth.ts                     MOD  + createMentor, activateMentor, resendMentorInvite
src/api/auth/controllers/auth.ts                  MOD  + 3 actions
src/api/auth/routes/auth.ts                       MOD  + 3 routes
src/index.ts                                      MOD  + ensureRolePermissions
src/extensions/users-permissions/
  content-types/user/schema.json                  MOD  + status
  strapi-server.ts                                MOD  login override
config/plugins.ts                                 DONE
package.json                                      DONE
.env                                              DONE  except MENTOR_ACTIVATION_TTL
```

`src/api/auth/interfaces/auth.ts:9` currently imports a `registerMentorSchema`
that does not exist; TypeScript is erroring today and this work resolves it.

Service and controller code follows the existing `createIndividual` structure.
One deliberate deviation: `createMentor` distinguishes "account created but
email failed" from "creation failed", because those require different
responses from the super admin — the blanket
`"A apărut o eroare necunoscută"` would hide that difference.

## Verification

Verified end to end on 2026-07-20 against Postgres and Mailpit, with
throwaway users created and deleted by the test script:

| Check | Result |
| --- | --- |
| Bootstrap grants both permissions on boot | pass |
| Super-admin creates mentor | 200, `status: pending`, `emailSent: true` |
| Activation email delivered to Mailpit | pass |
| Mentor login while pending | rejected |
| Activation sets password and `status: active` | pass, token cleared |
| Replayed activation link | rejected, single use holds |
| Mentor login after activation | 200 |
| Resend against an active mentor | rejected |
| Create without super-admin | 403 |
| Login with `status` forced to `pending` / `deleted` | rejected with the Romanian message |
| Individual register then login | 200, `provider: local`, JWT issued |
| NGO register then login | 200, `provider: local`, JWT issued |
| `npx tsc --noEmit` | clean |

The steps below reproduce it manually via Postman.

1. Create a super-admin user in the Strapi admin panel (Content Manager →
   User), with `status: active`.
2. `POST /api/auth/local` to obtain a JWT.
3. `POST /auth/register/mentor` with the bearer token → expect 200, and a user
   with `status: pending`.
4. Open http://localhost:8025, copy the `token` query parameter from the
   activation link.
5. `POST /auth/mentor/activate` with that token and a valid password → expect
   200 and `status: active`.
6. Replay the same request → expect rejection (single use).
7. `POST /api/auth/local` as the mentor → expect success.
8. Repeat step 3, then call resend and confirm the first link no longer works.
9. Call the create endpoint without a token, and as a non-super-admin → expect
   403 in both cases.

## Out of scope

Recorded so they are not lost, but explicitly not implemented here:

- **Soft delete.** Only the enum value is added. When implemented, the plan is
  to overwrite the email with a random value to release the address for reuse.
  Open questions at that point: whether `nume` and `telefon` also need
  clearing for GDPR erasure; whether the original email must be preserved for
  audit; and that already-issued JWTs survive deletion, since the login
  override only runs at login and not on authenticated requests.
- **Mentor listing endpoint.** Needed before an admin UI can call resend
  without knowing the id.
- **Consent persistence.** `acordTermeniSiConditii` is validated but never
  stored, for Individual accounts as well. Pre-existing; a real consent record
  is needed if the agreement matters legally.
- **Login error message for blocked/unconfirmed users** beyond the status
  check — Strapi's built-in messages remain English.
- **Backfilling `provider` on pre-existing users.** See the note above; those
  accounts remain unable to log in until the update is run.
