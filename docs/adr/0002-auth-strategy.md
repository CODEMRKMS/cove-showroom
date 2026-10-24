# ADR 0002: Authentication strategy

- Status: accepted
- Date: 2026-10-25

## Context

The kata asks for registration, login and JWT-protected routes. A bare "one JWT, long expiry" would
pass, but a stolen token would then work until it expires and could not be cut off. The browser app
also has to keep a session across page reloads without storing a credential where any script can
read it.

## Decision

**Two credentials, with different jobs.**

- **Access token**: a JWT signed HS256 with an explicit algorithm, `iss`, `aud`, `sub` and a 15 minute
  `exp` (`services/token-service.ts`). It travels in the `Authorization: Bearer` header. The frontend
  keeps it in a JavaScript variable only (`createTokenStore` in `frontend/src/api/client.ts`), never in
  `localStorage`, `sessionStorage` or a readable cookie, so it is gone when the tab closes.
- **Refresh token**: not a JWT. It is 32 random bytes (base64url) from `crypto.randomBytes`
  (`services/refresh-token.ts`). Only its SHA-256 hash is stored (`RefreshToken.tokenHash`, unique), so
  a database leak does not hand out usable tokens. The client holds it in a cookie that is `HttpOnly`,
  `SameSite=Lax`, `Path=/api/auth` and `Secure` when `NODE_ENV=production`
  (`controllers/auth.controller.ts`). An opaque token needs no signing secret, so there is only one
  secret (`JWT_ACCESS_SECRET`, at least 32 characters, checked at boot in `config.ts`).
  `MASTER_PROMPT.md` asks for separate access and refresh secrets; with an opaque refresh token the
  second secret would protect nothing.

**Rotation and reuse detection.** Every `POST /api/auth/refresh` retires the presented token and issues
a new one (`replacedById` links the chain). If a token that was already retired is presented again, the
server cannot tell whether the thief or the owner holds the newest token, so it **revokes every refresh
token of that user** (`AuthService.refresh`, `revokeAllForUser`). The same happens when two requests
race on one token and one loses (`rotate` returns false). Logout revokes the chain (`revokeChain`).
Tests: `auth.refresh.test.ts`, `auth.refresh.reuse.test.ts`, `auth.logout.test.ts`.

**The role is never read from the token.** The access token carries a `role` claim, but `authenticate`
loads the user from the database on every request (`AuthService.authenticate`). Demoting or deleting an
account therefore takes effect immediately instead of when the token expires.

**Login.** argon2id for password hashes. An unknown email is verified against a placeholder hash so it
costs the same as a wrong password, and both give the same `401 INVALID_CREDENTIALS`. Failed logins are
rate limited per IP (default 10 per 15 minutes; successes are not counted).

**Registration** always creates a `USER`; there is no `role` input (the body schema is `.strict()`). The
one admin comes from the seed script (`ADMIN_EMAIL`, `ADMIN_PASSWORD`).

## Trade-off: registration reveals which emails exist

`POST /api/auth/register` answers `409 EMAIL_TAKEN` for an address that already has an account. That
tells an attacker "this person is a customer". Login does not leak this. We accepted it because:

- The alternative (always answer 201 and email the owner) needs an email service, which this kata does
  not have, and it makes the sign-up form confusing: someone who submits the form and gets no account
  would not know why.
- The form can show a clear message ("an account with this email already exists").
- The exposure is limited to "this email has an account at a demo dealership". Registration sits behind
  the global rate limit (300 per minute per IP by default), which slows bulk probing but does not stop
  it.

What would close it properly: a generic "check your inbox" response plus a verification email, and a
stricter limiter on `/auth/register` specifically. Neither is built.

## Consequences

- A leaked access token is good for at most 15 minutes. A leaked refresh token works once; using it a
  second time (by either party) signs the user out everywhere. The cost is that a legitimate double
  refresh (two tabs refreshing at the same instant) can sign the user out and force a new login.
- There is no way to revoke an access token before it expires other than waiting out the 15 minutes
  (no `jti` deny-list). Role changes still apply at once because of the database lookup.
- HS256 means the API that verifies tokens also holds the key that can mint them. Fine for a single
  service; a multi-service setup would move to asymmetric keys.
- The rate limiters keep counts in process memory: they reset on restart and are per instance.
- Cross-site deployment (frontend and API on different sites) would need `SameSite=None; Secure` and a
  CORS allow-list entry. Local development avoids this with the Vite proxy, which keeps everything
  same-origin.
