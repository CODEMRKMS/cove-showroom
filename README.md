# Cove

Cove is a car dealership inventory system built as a TDD kata. A REST API on PostgreSQL handles
registration, login (JWT access tokens plus rotating refresh tokens) and admin/user roles. A React +
Tailwind single-page app lets signed-in users search and filter the catalogue and buy a car, and lets
admins add, edit, restock and delete cars.

> **Demo project.** "Purchase" is a simulated inventory action: there are no payments and no real
> cars. The 24 seeded vehicles use real make and model names, but **their prices and stock levels are
> demo data invented for this exercise**, not offers and not market prices.

![The Cove showroom](docs/screenshots/showroom.png)

<!--
TODO(me): add these captures to docs/screenshots/ (real screenshots of the running app, 1280 px wide
unless the name says mobile, which is 360 px). The README references exactly these file names:
  showroom.png            showroom signed in as a buyer (also the hero image above)
  showroom-filters.png    search text plus a category and price filter applied
  showroom-sold-out.png   a card whose Purchase button reads "Sold out" and is disabled
  purchase-confirm.png    the confirm dialog before buying
  purchase-success.png    the toast after a successful purchase, with the stock already lowered
  orders.png              My orders with at least one row
  admin.png               admin inventory dashboard (summary, table, activity feed)
  admin-add.png           the Add vehicle dialog
  login.png               login page
  register.png           register page showing a validation error
  mobile-showroom.png     showroom at 360 px wide
  mobile-admin.png        admin inventory at 360 px wide
  not-found.png           the 404 page
  api-docs.png            Swagger UI at /api/docs
-->

## Contents

1. [What the kata asks for and where it lives](#what-the-kata-asks-for-and-where-it-lives)
2. [Architecture](#architecture)
3. [Tech stack and why](#tech-stack-and-why)
4. [Local setup](#local-setup)
5. [API reference](#api-reference)
6. [Screenshots](#screenshots)
7. [Test report](#test-report)
8. [Performance and accessibility](#performance-and-accessibility)
9. [My AI Usage](#my-ai-usage)
10. [Known limitations and what I would do next](#known-limitations-and-what-i-would-do-next)
11. [Credits and licence](#credits-and-licence)

## What the kata asks for and where it lives

| Kata requirement | Where | Proof |
| --- | --- | --- |
| Real database (PostgreSQL, not in-memory) | Prisma schema and migration in `backend/prisma/` | Tests run against a real `cove_test` database (`backend/test/helpers/`) |
| Register and login with JWT | `backend/src/services/auth.service.ts`, `token-service.ts`; [ADR 0002](docs/adr/0002-auth-strategy.md) | `auth.register*.test.ts`, `auth.login*.test.ts`, `auth.jwt-middleware.test.ts` |
| Roles: `USER` and `ADMIN`, admin-only actions | One policy map: `backend/src/policy/access-policy.ts`; [ADR 0001](docs/adr/0001-admin-only-vehicle-writes.md) | `role-matrix.test.ts` states the expected answer for every route and role |
| `POST /api/vehicles` | `vehicle.routes.ts`, `vehicle.controller.ts` | `vehicles.create.test.ts` |
| `GET /api/vehicles` | same | `vehicles.list.test.ts` (pagination, sort) |
| `GET /api/vehicles/search` (make, model, category, price range, in stock, free text) | `prisma-vehicle.repository.ts` | `vehicles.search.test.ts` |
| `GET /api/vehicles/:id` | same | `vehicles.get.test.ts` |
| `PUT /api/vehicles/:id` | same | `vehicles.update.test.ts` |
| `DELETE /api/vehicles/:id` (admin) | soft delete, [ADR 0003](docs/adr/0003-soft-delete.md) | `vehicles.delete.test.ts` |
| `POST /api/vehicles/:id/purchase` | atomic, [ADR 0004](docs/adr/0004-atomic-purchase.md) | `vehicles.purchase.test.ts`, including the parallel race |
| `POST /api/vehicles/:id/restock` (admin) | `prisma-inventory.repository.ts` | `vehicles.restock.test.ts` |
| Each vehicle has a unique ID, make, model, category, price, quantity | `Vehicle` model in `backend/prisma/schema.prisma` | `vehicles.create.test.ts` |
| Frontend in React with Tailwind, HTML5 and CSS3 | `frontend/` | `npm run build`; 171 component and page tests |
| Register and login forms | `LoginPage.tsx`, `RegisterPage.tsx` | `frontend/src/auth/auth.test.tsx` |
| Dashboard with search and filter | `ShowroomPage.tsx`, `FilterBar.tsx` | `frontend/src/pages/showroom.test.tsx`, `lib/filters.test.ts` |
| Purchase button disabled at zero stock | `PurchaseButton.tsx` | `components/PurchaseButton.test.tsx`, `pages/purchase.test.tsx` |
| Admin forms to add, update and delete vehicles; hidden from non-admins | `AdminPage.tsx`, `VehicleFormDialog.tsx`, `RequireAdmin` in `auth/guards.tsx` | `pages/admin.test.tsx`; the server enforces the same rule |
| Visible Red, Green, Refactor commit history | `git log --oneline` | [Test report](#test-report) |
| Test report | [`docs/test-report/`](docs/test-report/) | [Test report](#test-report) |
| `PROMPTS.md` (raw AI chat logs) | [`PROMPTS.md`](PROMPTS.md) | written by me, unedited |
| "My AI Usage" | [below](#my-ai-usage) | written by me |

Extras beyond the kata: refresh-token rotation with reuse detection, an inventory event ledger and
`GET /api/admin/events`, `GET /api/orders/mine`, health and readiness probes, OpenAPI docs at
`/api/docs`, helmet, a CORS allow-list, global and login rate limits, structured logs with secrets
redacted, graceful shutdown.

## Architecture

```mermaid
flowchart LR
  Browser["React SPA<br/>(Vite, Tailwind)"] -- "/api (Vite proxy in dev)" --> API
  subgraph API["Express API"]
    direction TB
    MW["helmet · CORS · rate limit · request id · pino-http"] --> R["routes<br/>authenticate + authorize(policy map)"]
    R --> C["controllers<br/>Zod validation, HTTP shaping"]
    C --> S["services<br/>business rules"]
    S -- "repository interfaces" --> Repo["repositories<br/>(only layer that touches Prisma)"]
  end
  Repo --> DB[("PostgreSQL 16<br/>users · vehicles · orders<br/>inventory events · refresh tokens")]
```

- **Layers** run `routes -> controllers -> services -> repositories`. Services depend on repository
  interfaces; `backend/src/container.ts` is the one place concrete classes are chosen, and
  `createApp(deps)` builds the app the same way for the server and for every test.
- **Errors** all use one RFC 7807 style envelope with a request id, and never include a stack trace.
- **Money** is stored as integer minor units (paise) in `BigInt` columns.
- **Role rules** live in one map (`ACCESS_POLICY`); routes call `authorize('<METHOD> <path>')`.

Decision records: [0001 admin-only create and update](docs/adr/0001-admin-only-vehicle-writes.md) ·
[0002 authentication](docs/adr/0002-auth-strategy.md) · [0003 soft delete](docs/adr/0003-soft-delete.md) ·
[0004 atomic purchase](docs/adr/0004-atomic-purchase.md) · [0005 SVG cars now, 3D later](docs/adr/0005-svg-cars-now-3d-later.md).
Interview preparation: [`docs/INTERVIEW_NOTES.md`](docs/INTERVIEW_NOTES.md). Frontend design notes: [`docs/design.md`](docs/design.md).

## Tech stack and why

| Part | Choice | Why |
| --- | --- | --- |
| API | Node.js 22, Express 5, TypeScript (strict) | Small, well understood, async errors reach the error handler without wrappers |
| Database | PostgreSQL 16 via Prisma 7 | Real transactions and row locks (needed for atomic purchase); typed queries; committed migrations |
| Validation | Zod | One schema gives validation, coercion and a typed result; `.strict()` blocks mass assignment |
| Auth | `jsonwebtoken` (HS256), `argon2` (argon2id), opaque refresh tokens | See [ADR 0002](docs/adr/0002-auth-strategy.md) |
| Hardening | helmet, cors, express-rate-limit, pino + pino-http | Standard, small, each covered by tests |
| API tests | Vitest + Supertest against a real database | No mocks of the layer being tested |
| Frontend | React 19, Vite, React Router 7, TanStack Query, Tailwind CSS 4 | Query handles loading/error/cache states and the optimistic purchase |
| Frontend tests | Vitest, Testing Library, MSW, axe-core | Tests exercise pages through the DOM with the network mocked at the HTTP boundary |
| CI | GitHub Actions with a `postgres` service container | Lint, format check, typecheck, tests with coverage, build, `npm audit` on production dependencies |

## Local setup

**Prerequisites:** Node.js 22.13 or newer (checked with 22.14.0), npm, and PostgreSQL 16 running
locally. No Docker is used or needed.

```bash
# 1. Clone
git clone https://github.com/CODEMRKMS/cove-showroom.git
cd cove-showroom

# 2. Create two empty databases (use your own superuser; on Windows psql is in
#    C:\Program Files\PostgreSQL\16\bin if it is not on PATH)
psql -U postgres -c "CREATE DATABASE cove_dev;"
psql -U postgres -c "CREATE DATABASE cove_test;"   # psql asks for the postgres password

# 3. Install both packages and generate the Prisma client
npm run setup

# 4. Configure the API (copy, then edit the values marked below)
cp backend/.env.example backend/.env
```

Edit `backend/.env`:

| Variable | Set it to |
| --- | --- |
| `DATABASE_URL` | `postgresql://USER:PASSWORD@localhost:5432/cove_dev` |
| `DATABASE_URL_TEST` | same server, database `cove_test` (the name must end in `_test`; the suite refuses to run otherwise) |
| `JWT_ACCESS_SECRET` | 32+ random characters, e.g. `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | the admin account the seed creates. The password follows the registration policy (10+ characters, not a common password), so `CHANGE_ME` is rejected |
| `DEMO_USER_EMAIL`, `DEMO_USER_PASSWORD` | optional plain `USER` account for trying the buyer flow (set both or neither) |

Everything else is optional; see the comments in `backend/.env.example` (`PORT`, `CORS_ORIGINS`,
rate limits, `LOG_LEVEL`).

```bash
# 5. Create the tables and load the demo catalogue (24 vehicles, the admin, the optional demo user)
npm run db:deploy
npm run db:seed

# 6. Run the API (http://localhost:3000) and, in a second terminal, the app (http://localhost:5173)
npm run dev:backend
npm run dev:frontend
```

Open <http://localhost:5173>, sign in with the seeded admin or demo user (or register a new
account), and the API docs are at <http://localhost:3000/api/docs>.

The dev server proxies `/api` to the backend, so the refresh-token cookie is same-origin. If the
backend runs on another port, start the frontend with `API_PROXY_TARGET=http://localhost:<port>`.
To change the frontend port, call Vite directly (the root script does not forward flags):
`npm --prefix frontend run dev -- --port 5175`.

**Seeded accounts:** whatever you put in `.env` (`ADMIN_EMAIL` / `ADMIN_PASSWORD`, and the optional
demo user). Nothing is hard-coded in the repository. Running `npm run db:seed` again is safe: it adds
only missing vehicles and never brings back one an admin deleted.

### Running the checks

```bash
npm test                # backend (migrates cove_test first) then frontend
npm run test:coverage   # same, with coverage and the 90% thresholds on services/controllers/middleware
npm run test:report     # same, and writes the HTML/JUnit/coverage reports into docs/test-report/
npm run lint && npm run typecheck && npm run build
```

`npm run db:reset` drops and recreates `cove_dev` from the migrations (it deletes all data in
`cove_dev`).

## API reference

Base path `/api`, JSON only. Full reference: Swagger UI at `/api/docs`, machine-readable at
`/api/openapi.json`. A test (`openapi.test.ts`) checks that every documented route exists.

| Method | Path | Who | Notes |
| --- | --- | --- | --- |
| POST | `/auth/register` | public | Creates a `USER`; never accepts `role`. 409 if the email is taken |
| POST | `/auth/login` | public | Access token in the body, refresh token in an `HttpOnly` cookie. Rate limited |
| POST | `/auth/refresh` | cookie | Rotates the refresh token, returns a new access token |
| POST | `/auth/logout` | cookie | Revokes the refresh token chain. 204 |
| GET | `/auth/me` | signed in | Current user |
| GET | `/vehicles` | signed in | Paginated (`page`, `pageSize` up to 50), `sort=price\|-price\|make\|-createdAt` |
| GET | `/vehicles/search` | signed in | `q`, `make`, `model`, `category`, `minPrice`, `maxPrice`, `inStock`, plus paging and sort |
| GET | `/vehicles/:id` | signed in | 404 if missing or deleted |
| POST | `/vehicles` | **admin** | Create. 201 |
| PUT | `/vehicles/:id` | **admin** | Update details (not quantity) |
| DELETE | `/vehicles/:id` | **admin** | Soft delete. 204 |
| POST | `/vehicles/:id/purchase` | signed in | `{ "quantity": 1 }` optional (1 to 10). Atomic. 409 `OUT_OF_STOCK` when short |
| POST | `/vehicles/:id/restock` | **admin** | `{ "quantity": n }` |
| GET | `/orders/mine` | signed in | The caller's orders |
| GET | `/admin/events` | **admin** | Recent inventory events |
| GET | `/health`, `/ready` | public | Liveness; readiness (pings the database) |

Prices are integer minor units (paise): `650000000` means ₹6,500,000.

```bash
# Sign in (use the admin or demo user from your .env)
curl -s -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"your-password"}'
# -> {"accessToken":"eyJ...","tokenType":"Bearer","expiresIn":900,"user":{...}}

TOKEN=eyJ...   # paste the accessToken

# Search: Hyundai cars under ₹10 lakh that are in stock, cheapest first
curl -s -H "Authorization: Bearer $TOKEN" \
  'http://localhost:3000/api/vehicles/search?q=hyundai&maxPrice=100000000&inStock=true&sort=price'

# Buy one unit (409 OUT_OF_STOCK when none are left)
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"quantity":1}' http://localhost:3000/api/vehicles/<id>/purchase
```

Every error has the same shape:

```json
{ "type": "about:blank", "title": "Conflict", "status": 409, "code": "OUT_OF_STOCK",
  "detail": "Only 0 units left.", "requestId": "…" }
```

## Screenshots

| | |
| --- | --- |
| ![Showroom](docs/screenshots/showroom.png) | ![Search and filters](docs/screenshots/showroom-filters.png) |
| Showroom | Search and filters |
| ![Sold out](docs/screenshots/showroom-sold-out.png) | ![Confirm purchase](docs/screenshots/purchase-confirm.png) |
| Purchase disabled at zero stock | Confirm dialog |
| ![Purchase success](docs/screenshots/purchase-success.png) | ![My orders](docs/screenshots/orders.png) |
| Purchase result | My orders |
| ![Admin dashboard](docs/screenshots/admin.png) | ![Add vehicle](docs/screenshots/admin-add.png) |
| Admin inventory | Add vehicle |
| ![Login](docs/screenshots/login.png) | ![Register](docs/screenshots/register.png) |
| Login | Register |
| ![Mobile showroom](docs/screenshots/mobile-showroom.png) | ![Mobile admin](docs/screenshots/mobile-admin.png) |
| Mobile showroom (360 px) | Mobile admin (360 px) |
| ![404](docs/screenshots/not-found.png) | ![API docs](docs/screenshots/api-docs.png) |
| 404 page | Swagger UI |

Not built, so not shown: a home/hero page, a vehicle detail page, dark mode.

## Test report

Numbers below come from `npm run test:report`, run on 25 Oct 2026 (see the commit that added the
report files). They are not edited by hand.

| | Test files | Tests | Statements | Branches | Functions | Lines |
| --- | --- | --- | --- | --- | --- | --- |
| Backend (Vitest + Supertest, real PostgreSQL) | 41 | 383 passed | 99.26% | 96.81% | 99.46% | 99.6% |
| Frontend (Vitest + Testing Library + MSW) | 15 | 171 passed | 91.16% | 82.71% | 93.28% | 92.75% |

Backend coverage excludes the two command-line entry points (`src/server.ts`, `src/seed/run.ts`) and the
generated Prisma client. `src/server.ts` was checked by running it: it starts, logs, and shuts down
cleanly on SIGINT. The backend run enforces a 90% threshold on services, controllers and middleware and
passed. The frontend has no coverage threshold; the number is reported, not enforced.

Reports (all generated files):

- Backend: [JUnit](docs/test-report/backend/junit.xml) · [coverage](docs/test-report/backend/coverage-report/index.html) · Vitest HTML report (needs a local server: `npx vite preview --outDir docs/test-report/backend/html` from the `frontend` folder, because the file loads its data with `fetch`)
- Frontend: [JUnit](docs/test-report/frontend/junit.xml) · [coverage](docs/test-report/frontend/coverage-report/index.html) · [Vitest HTML report](docs/test-report/frontend/html/index.html) (one self-contained file)

**How TDD was applied.** From the first backend behaviour onwards, each behaviour is a pair or trio of
commits: `test(...) [RED]` (test code only, run and seen to fail for the right reason), then
`feat(...) [GREEN]` (the smallest change that passes), then `refactor(...)` when it was worth doing.
`git log --oneline` shows the sequence. Examples:

| Behaviour | RED | GREEN |
| --- | --- | --- |
| Atomic purchase survives a parallel race | `6bdd9ff` | `bf39c7d` |
| Refresh-token reuse is detected | `36fadf9` | `1523fcb` |
| Purchase disabled at zero stock (UI) | `901ec37` | `1fd044d` |
| helmet security headers | `6cf6784` | `cb10c89` |
| Global rate limit | `d7e0759` | `c9644e9` |
| Structured logs with redaction | `90e144a` | `479e162` |
| Graceful shutdown | `3db986e` | `eb48227` |

Refactor commits, e.g. `410d6fb` (guard `/api/auth/me` through the access policy). The history is
honest about slips too: some commits fix a mistake made earlier (for example `0a7a214`, where a test I
committed without running the whole suite had to be corrected), and not every change has a test first:
configuration changes, test-infrastructure work and the visual accent fix `876962f` (found by looking at
the running app; jsdom does not load CSS) are labelled as such in their messages.

## Performance and accessibility

- **Accessibility, automated:** axe-core runs in the test suite on login, register (with its error
  state), showroom, showroom with the purchase dialog open, My orders, admin, the admin Add dialog and
  the 404 page, and finds no violations (`frontend/src/pages/accessibility.test.tsx`; `src/test/axe.test.tsx` checks the helper really reports a problem). jsdom has no layout or CSS, so
  axe's colour-contrast rule is switched off there. Contrast ratios in `docs/design.md` were computed
  with the WCAG formula from the palette, and the app was checked by eye in a browser; contrast was not
  measured on the rendered pages with a tool. Only one theme (light) exists.
- **Accessibility, manual:** no screen reader pass has been done.
- **Bundle (measured with `npm --prefix frontend run build` on 25 Oct 2026):** JavaScript 430.95 kB
  (131.98 kB gzip), CSS 26.39 kB (5.91 kB gzip), plus self-hosted font files loaded on demand.
- **Lighthouse, LCP, INP, CLS:** **not measured.** No numbers are given because none were taken.

## My AI Usage

TODO(me): write this section in your own words. Do not paste the AI's wording. Suggested headings,
each with the question to answer; delete this line when done.

### Which AI tools I used

TODO(me): name each tool and the version or model if you know it. Which phases did each one help
with (planning, backend, frontend, tests, documentation)?

### How I used each one

TODO(me): give two or three concrete examples from this repository. Link a commit hash or a file, and
say what you asked for and what you got back.

### What I checked or rewrote by hand

TODO(me): which outputs did you read line by line, run yourself, or change? Say what you changed and
why (for example the `PUT` admin-only decision in ADR 0001, the seed data, the design choices).

### Where the AI was wrong, and how I caught it

TODO(me): describe at least one real mistake. The history has candidates you can check and decide
whether to use (commit `0a7a214`, the `cors` credentials header caught by a RED test in `1494099`,
the invented pino-http 5xx error in `479e162`); only write what you actually remember or can verify.

### Process: how Red, Green, Refactor worked with an AI

TODO(me): who wrote the failing test, who decided it failed for the right reason, and how did you
keep the AI from writing code before a test? What did you do when it did?

### Reflection

TODO(me): how did AI change your workflow, what would you do differently, and what would you not let
it do next time?

## Known limitations and what I would do next

Honest list, roughly in order of importance:

1. **No Lighthouse/LCP/INP/CLS numbers and no screen-reader testing.** Only automated axe in jsdom.
2. **Cars are flat SVG illustrations.** The 3D studio from the original brief is not built
   ([ADR 0005](docs/adr/0005-svg-cars-now-3d-later.md)).
3. **No vehicle detail page, no home page, no dark mode.** `GET /api/vehicles/:id` exists and is
   tested but the app has no page for it. The root path redirects to the showroom.
4. **Registration reveals which emails exist** (409), and has no per-route rate limit. See
   [ADR 0002](docs/adr/0002-auth-strategy.md).
5. **Rate limiters are in memory and per process.** They reset on restart and do not share counts across
   instances. Behind a reverse proxy, Express must be told to trust it (`trust proxy`), which is not
   configured, so all clients would share the proxy's address.
6. **Access tokens cannot be revoked before they expire** (15 minutes), and a double refresh from two
   tabs at the same instant can sign the user out.
7. **No deployment.** Nothing is hosted; there is no live link. Cross-site hosting would need
   `SameSite=None; Secure` cookies and a CORS entry for the frontend origin.
8. **No end-to-end browser test.** The frontend tests run in jsdom with a mocked network. In the
   clean-clone check the API was exercised with `curl` through the Vite proxy against a real database,
   but the finished pages were not driven in a browser as part of the documentation work.
9. **No restore for soft-deleted vehicles** and no purge.
10. **Search is substring matching** (`ILIKE`), not full-text search; fine for 24 cars, not for a large
    catalogue.
11. **Seed data is invented** (see the notice at the top). Vehicle prices are not real offers.
12. **GitHub Actions results were not checked from this machine** (no `gh` CLI here). The workflow is in
    `.github/workflows/ci.yml`; its commands were run locally, but I have not seen it run on GitHub.

## Credits and licence

Fonts, icons and artwork are listed in [`CREDITS.md`](CREDITS.md). All code, the logo and the car
illustrations were written for this project. Licence: TODO(me): choose one and add a `LICENSE` file
(no licence file exists yet, which means "all rights reserved" by default).
