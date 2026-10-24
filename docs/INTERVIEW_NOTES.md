# Interview notes

Fifteen questions a reviewer is likely to ask about this codebase, with answers taken from the code as
it is, including the weak spots. File names are real; open them while you read. Question 15 needs your
own words and is left for you.

---

### 1. Walk me through the architecture. Why four layers?

Requests go `routes -> controllers -> services -> repositories`. Routes only attach middleware
(`authenticate`, then `authorize('<METHOD> <path>')`). Controllers parse and validate input with Zod
and shape the HTTP response. Services hold the business rules. Repositories are the only code that
touches Prisma. Services depend on repository *interfaces* (`vehicle.repository.ts`), and
`container.ts` is the single place where the Prisma implementations are chosen and wired. `createApp(deps)`
builds the app, so the server and every test construct it the same way.

The benefit is concrete: unit tests such as `test/unit/auth.service.login.test.ts` can swap a
repository, while the integration tests use the real thing. The cost is boilerplate for a small app; I would say so.

### 2. How do you stop two people buying the last car?

`PrismaInventoryRepository.purchase` runs a transaction whose first statement is
`updateMany({ where: { id, deletedAt: null, quantity: { gte: n } }, data: { quantity: { decrement: n } } })`,
which is one SQL `UPDATE ... WHERE quantity >= n`. PostgreSQL locks the row; a competing buyer waits and
then re-checks against the new value. If `count` is 0 a second read says whether it was 404 or 409. The
order and the `PURCHASED` event are written in the same transaction, so there is never a stock change
without both. The schema also has `CHECK (quantity >= 0)` as a backstop.

Proof: `vehicles.purchase.test.ts` fires 10 simultaneous purchases at 3 units: exactly 3 succeed, 7 get
409, stock ends at 0. See [ADR 0004](adr/0004-atomic-purchase.md). Honest limit: the test runs in one
process; the guarantee comes from PostgreSQL, so it holds across instances, but I did not run several.

### 3. Explain the login and token design.

Login returns a 15 minute HS256 JWT in the body (explicit algorithm, `iss`, `aud`, `sub`). It also sets
a refresh token as an `HttpOnly`, `SameSite=Lax`, `Path=/api/auth` cookie. The refresh token is 32
random bytes, not a JWT; only its SHA-256 hash is stored, so a database leak yields nothing usable.
Passwords are argon2id. Unknown email and wrong password give the same 401 and cost about the same
(a placeholder hash is verified for unknown emails). [ADR 0002](adr/0002-auth-strategy.md) has the
reasoning and the trade-offs.

### 4. What is refresh-token reuse detection, and what does it cost?

Each refresh retires the old token and links it to the new one. If a *retired* token shows up again,
either a thief or the owner is replaying it and the server cannot tell which, so it revokes every
refresh token of that user. Tests: `auth.refresh.reuse.test.ts`. The cost: if two tabs refresh at the
same instant, the loser looks like a replay and the user is signed out. The frontend avoids this inside
one tab with a single-flight refresh (`createApiClient` in `frontend/src/api/client.ts`), but two tabs
can still collide.

### 5. Where is the access token stored on the client, and why?

In a JavaScript variable (`createTokenStore`), never `localStorage`, so an XSS bug cannot lift a
long-lived token from storage and the token disappears when the tab closes. After a reload the app
asks `/api/auth/refresh`, which succeeds if the `HttpOnly` cookie is still valid. The cookie is scoped to
`/api/auth` and `SameSite=Lax`, so a cross-site POST does not carry it. Caveat: XSS could still call the
API while the tab is open, and React escaping (no `dangerouslySetInnerHTML` anywhere in `frontend/src`) is
the main defence.

### 6. Why are POST and PUT on vehicles admin-only? The kata only says delete and restock.

The kata's backend list marks only DELETE and restock as admin-only, but its frontend section says
"(For Admin Users) Forms/UI to add, update, and delete vehicles". Letting any customer change prices
would break the inventory, so I followed the frontend line and wrote it down in
[ADR 0001](adr/0001-admin-only-vehicle-writes.md), with the two-line change if a reviewer reads it the
other way. All role rules are one map, `ACCESS_POLICY` in `access-policy.ts`. `authorize()` looks the
route up when the app is built, so a route with no entry fails at startup, and `role-matrix.test.ts`
checks every route for anonymous, user and admin independently of the map.

### 7. Does the server trust the role in the JWT?

No. The token carries a `role` claim but `authenticate` loads the user from the database on every request
and uses that role. Demoting or deleting an account takes effect immediately. The price is one indexed
query per request.

### 8. Why soft delete, and what are the downsides?

Orders and the inventory ledger reference vehicles. A hard delete would break them or cascade away
customers' history. `deletedAt` hides the car everywhere (the filter is in the repositories), and orders keep
their own `unitPrice`, `totalPrice` and `vehicleLabel`. Downsides: the filter is a convention every new
query must follow (the database does not enforce it), there is no restore or purge, and deleting twice
is a 404 by design. [ADR 0003](adr/0003-soft-delete.md).

### 9. How is money handled?

As integer minor units (paise) in `BigInt` columns, never floats. Repositories convert to `number` at
the boundary (`prisma-mappers.ts`); the API caps price at 1e12 paise so it always round-trips as a JSON
number exactly (well below 2^53). The frontend formats with `Intl.NumberFormat('en-IN')` in
`lib/money.ts`. A 4 crore car is 4,000,000,000 paise, which overflows a 32-bit `Int`, hence `BigInt`.

### 10. How do errors and logs work? Could a stack trace or a token leak?

All errors go through one handler into one envelope (`type`, `title`, `status`, `code`, `detail`,
`requestId`, optional `errors`). Unexpected errors become a fixed 500 message; the real error is logged
with the request id, so the id the client sees leads to the cause. `error-envelope.test.ts` checks that
a database error's text, host and password never appear in the response. Logs are pino JSON lines;
`Authorization`, `Cookie` and `Set-Cookie` are redacted by pino itself, request bodies are never
logged, and health probes are skipped. `logging.test.ts` checks the raw log text for the real refresh
cookie value after a login.

### 11. Why test against a real PostgreSQL instead of mocks or SQLite?

The things that matter here are database behaviour: row locks in the purchase race, `CHECK` constraints,
unique violations on simultaneous registration, `ILIKE`, `BigInt`. An in-memory database would not
prove those. Cost: the backend suite takes about two and a half minutes (147 s in the last report run) because files run serially
(`fileParallelism: false`) on one database truncated between tests. Safety: the suite refuses to run unless the database name ends in `_test`.

### 12. Show me TDD in this history, including a time it went wrong.

`git log --oneline` shows RED, GREEN and refactor commits. A good example is the CORS work: the RED test
"sends no CORS headers to an origin that is not on the list" caught that the `cors` package still sends
`Access-Control-Allow-Credentials: true` to an unlisted origin when given a plain array, so I switched to a
per-request options function (commit `1494099`). Another: while making the logging tests pass, pino-http
turned out to invent an `Error` with a meaningless stack for every 5xx, so that serializer is switched off
(`479e162`). A slip: commit `0a7a214` fixes a test that had been committed without running the whole suite.
Not everything is test-first: configuration, test infrastructure and a CSS bug found by looking at the
running app are labelled as such.

### 13. How does the purchase flow feel instant but stay correct on the frontend?

`useBuyVehicle` (`frontend/src/api/vehicles.ts`) lowers the stock in the TanStack Query cache immediately
(optimistic), sends the request, and on error restores the cached pages it saved and shows the server's
message (for example 409 "Only 0 units left"). On success or failure it invalidates the vehicles, inventory and
orders queries so the screen shows the server's truth. The Buy button is rendered disabled with the text
"Sold out" when quantity is 0 (`PurchaseButton.tsx`), but the server enforces the rule regardless.
`purchase.test.tsx` covers the confirm dialog, the optimistic drop and the 409 rollback.

### 14. What breaks if this gets real traffic? What would you change first?

In order: the rate limiters are in memory and per process (use a shared store), and behind a reverse
proxy `trust proxy` is not set, so every client would appear as the proxy's address and share one
bucket. Access tokens cannot be revoked inside their 15 minutes. Search is `ILIKE '%term%'`, fine for 24
cars, not for a big catalogue (use a trigram index or full-text search). Registration leaks which emails
exist (409). Nothing is deployed (a cross-site deployment would need `SameSite=None; Secure` cookies). The README lists these under "Known limitations".

### 15. How did you use AI on this, and how do you know the code is right?

TODO(me): answer in your own words. Facts you can build on, all checkable in the repository:

- The project rules in `CLAUDE.md` forbid the assistant from committing without your say-so and require
  RED, then GREEN, as separate commits; the `Co-authored-by` trailer is on every AI-assisted commit.
- Evidence the code is right: 383 backend tests against a real database and 171 frontend tests passed in
  the last report run (`docs/test-report/`), including the purchase race and the role matrix.
- What the tests cannot show: how the app looks and feels in a real browser, Lighthouse and screen reader
  results, and behaviour on a deployed host. Say that plainly.
- Say which parts you wrote or rewrote yourself, which decisions you made (for example ADR 0001), and
  one place the AI was wrong that you caught.
