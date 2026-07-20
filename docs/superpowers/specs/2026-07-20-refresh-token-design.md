# Refresh Tokens — Design

**Date:** 2026-07-20
**Status:** Approved for implementation

## Overview

Access tokens currently live 30 days (the users-permissions default at
`plugin-users-permissions/dist/server/index.js:4695`, never overridden) and
cannot be revoked. This replaces that with a short-lived access token plus a
stored, rotating refresh token, giving both a small theft window and real
session revocation.

## Decisions

| Decision | Choice | Rationale |
| --- | --- | --- |
| Storage | New `refresh-token` content-type | Stateless tokens cannot be revoked; a single column per user would break multi-device login. |
| Rotation | Rotate on every use, with reuse detection | Detects a stolen token instead of failing silently. The main reason to store tokens at all. |
| Delivery | JSON response body | Postman- and mobile-friendly, no CORS credential or CSRF work. The client is responsible for safe storage. |
| Access token TTL | 15 minutes | Common default; practical range is 5–60 minutes. |
| Refresh token TTL | 30 days | Users stay logged in for a month of normal use. |
| Token format | Opaque random bytes, sha256-hashed at rest | A database leak yields no usable tokens. |

Out of scope by choice: a logout-all-devices endpoint. No client needs it yet.

### Breaking change

Any client holding a 30-day JWT must now implement refresh-on-401: catch the
401, call `/auth/refresh`, retry the original request. Without it, sessions
break every 15 minutes. Nothing consumes this API yet, which is why the change
is free now and would be a coordinated migration later.

## Content-type

`src/api/refresh-token/content-types/refresh-token/schema.json`

```
tokenHash   string    unique, indexed
user        relation  manyToOne -> plugin::users-permissions.user
familyId    string    indexed
expiresAt   datetime
revokedAt   datetime  nullable
userAgent   string    nullable
```

`draftAndPublish: false`. The API folder contains a content-type and a service
only — no routes or controller — so Strapi exposes no CRUD endpoints for it.

The raw token is 48 random bytes as hex, opaque rather than a JWT. Only its
sha256 hash is stored. `familyId` links every token descended from a single
login, which is what makes reuse detection possible.

## Endpoints

Both use `config: { auth: false }`: they authenticate via the refresh token
itself, not a bearer JWT.

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| `POST` | `/auth/refresh` | `{ refreshToken }` | `{ jwt, refreshToken }` |
| `POST` | `/auth/logout` | `{ refreshToken }` | `{ message }`, always 200 |

`POST /api/auth/local` additionally returns `refreshToken`.

## Flows

### Login

Handled inside the existing `strapi-server.ts` wrapper, after the `status`
check passes: generate a raw token, store its hash under a fresh `familyId`,
attach the raw value to the response body.

### Refresh

1. sha256 the presented token and look up the row
2. Not found → reject
3. Found but already revoked → **reuse detected**: revoke every row sharing
   that `familyId`, then reject
4. Expired → reject
5. Owning user's `status` is not `active` → reject
6. Otherwise revoke this row, insert a replacement carrying the same
   `familyId`, and return a fresh access JWT with the new refresh token

Every rejection returns the same generic message, consistent with the mentor
activation endpoint, so the endpoint cannot be used to probe token state.

Step 5 means a deleted or suspended user loses access at their next refresh,
within 15 minutes, rather than at the end of a 30-day window.

### Logout

Revoke the presented token. Return 200 whether or not it existed, so the
endpoint cannot be used to test whether a token is valid.

### Mentor activation

`activateMentor` revokes all of that user's existing tokens. This is also the
correct hook for future password changes and resets.

### Cleanup

A daily job in `config/cron-tasks.ts` (03:00) deletes rows whose `expiresAt`
has passed, or whose `revokedAt` is older than 30 days. Rotation produces
roughly 96 rows per user per month, so the table grows without bound
otherwise.

It also deletes **orphaned rows** — tokens whose user has been deleted.
Deleting a user drops the link row but leaves the token behind. Those tokens
are already unusable (`rotate` rejects a record with no user), so this is
hygiene rather than security, but without it they linger until natural
expiry.

## Structure

Token logic lives in `src/api/refresh-token/services/refresh-token.ts`:
`issue`, `rotate`, `revoke`, `revokeAllForUser`, `cleanup`. The auth
controller and the login wrapper call into it and never query the table
directly, keeping storage details in one file.

`strapi-server.ts` gains token issuance alongside its existing status check.
The auth controller grows to five actions; if it keeps growing, splitting the
mentor actions into their own controller is the natural next step, but not
yet.

## Configuration

```ini
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_TTL=30d
```

`config/plugins.ts` gains `users-permissions.jwt.expiresIn` reading
`JWT_EXPIRES_IN`, overriding the plugin's 30-day default.

## Files

```
src/api/refresh-token/content-types/refresh-token/schema.json   NEW
src/api/refresh-token/services/refresh-token.ts                 NEW
src/api/auth/validation/auth.ts                                 MOD  + refreshTokenSchema
src/api/auth/interfaces/auth.ts                                 MOD  + payload type
src/api/auth/services/auth.ts                                   MOD  revoke on activation
src/api/auth/controllers/auth.ts                                MOD  + refresh, logout
src/api/auth/routes/auth.ts                                     MOD  + 2 routes
src/extensions/users-permissions/strapi-server.ts               MOD  issue on login
config/plugins.ts                                               MOD  jwt.expiresIn
config/cron-tasks.ts                                            MOD  cleanup job
.env                                                            MOD  2 keys
```

## Implementation note

Strapi's query engine **cannot filter by a relation in bulk writes**.
`updateMany({ where: { user: userId } })` emits a join alias that is invalid
inside an UPDATE and fails with `missing FROM-clause entry for table "t2"`.
`revokeAllForUser` and the orphan sweep in `cleanup` therefore resolve ids
with `findMany` first, then act by primary key. Scalar filters
(`tokenHash`, `familyId`, `expiresAt`) work fine in bulk writes.

This surfaced as a regression in the mentor activation flow: the activation
itself succeeded, but the revoke call threw and the service's catch-all
turned it into a generic error. Worth remembering that the blanket
`"A apărut o eroare necunoscută"` hides the real cause.

## Verification

Verified on 2026-07-20 against the real database:

| Check | Result |
| --- | --- |
| Login returns `jwt` and `refreshToken` | pass |
| Access token lifetime | 15 min |
| Refresh returns a new pair, token rotated | pass |
| Replaying a used token | rejected |
| Reuse detection revokes the whole family | pass, the valid token died too |
| Logout revokes the presented token | pass |
| Refresh after logout | rejected |
| Logout with an unknown token | 200 |
| Expired token (forced via SQL) | rejected |
| Non-active user cannot refresh | rejected |
| `cleanup()` removes expired and orphaned rows | pass, 6 removed |
| Mentor flow regression suite | pass |
| `npx tsc --noEmit` | clean |

## Out of scope

- Logout-all-devices endpoint
- httpOnly cookie delivery, should a browser client later want it
- Revoking tokens on password change through the plugin's own reset flow —
  only mentor activation is hooked here
