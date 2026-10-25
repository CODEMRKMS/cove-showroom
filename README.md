# Cove

Cove is a car dealership inventory system built as a TDD kata. A REST API on PostgreSQL handles
registration, login (JWT access tokens plus rotating refresh tokens) and admin/user roles. A React +
Tailwind single-page app lets signed-in users search and filter the catalogue and buy a car, and lets
admins add, edit, restock and delete cars.

> **Demo project.** "Purchase" is a simulated inventory action: there are no payments and no real
> cars. The 24 seeded vehicles use real make and model names, but **their prices and stock levels are
> demo data invented for this exercise**, not offers and not market prices.

![The Cove showroom](docs/screenshots/showroom.png)

## Contents

1. [What the kata asks for and where it lives](#what-the-kata-asks-for-and-where-it-lives)
2. [Architecture](#architecture)
3. [3D studio](#3d-studio)
4. [Tech stack and why](#tech-stack-and-why)
5. [Local setup](#local-setup)
6. [API reference](#api-reference)
7. [Screenshots](#screenshots)
8. [Test report](#test-report)
9. [Performance and accessibility](#performance-and-accessibility)
10. [My AI Usage](#my-ai-usage)
11. [Known limitations and what I would do next](#known-limitations-and-what-i-would-do-next)
12. [Credits and licence](#credits-and-licence)

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
| Frontend in React with Tailwind, HTML5 and CSS3 | `frontend/` | `npm run build`; 366 frontend tests |
| Register and login forms | `LoginPage.tsx`, `RegisterPage.tsx` | `frontend/src/auth/auth.test.tsx` |
| Dashboard with search and filter | `ShowroomPage.tsx`, `FilterBar.tsx` | `frontend/src/pages/showroom.test.tsx`, `lib/filters.test.ts` |
| Purchase button disabled at zero stock | `PurchaseButton.tsx` | `components/PurchaseButton.test.tsx`, `pages/purchase.test.tsx` |
| Admin forms to add, update and delete vehicles; hidden from non-admins | `AdminPage.tsx`, `VehicleFormDialog.tsx`, `RequireAdmin` in `auth/guards.tsx` | `pages/admin.test.tsx`; the server enforces the same rule |
| Visible Red, Green, Refactor commit history | `git log --oneline` | [Test report](#test-report) |
| Test report | [`docs/test-report/`](docs/test-report/) | [Test report](#test-report) |
| `PROMPTS.md` (raw AI chat logs) | [`PROMPTS.md`](PROMPTS.md) and [`prompts/`](prompts/) | raw logs; the only edit is secret redaction |
| "My AI Usage" | [below](#my-ai-usage) | written by me |

Extras beyond the kata: a public landing page at `/`, a vehicle detail page (`/vehicles/:id`) with a
paint picker and a lazy-loaded 3D car (see [3D studio](#3d-studio)), refresh-token rotation with reuse detection, an inventory event ledger and
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

## 3D studio

Cars are drawn two ways. Every car has a hand-written SVG illustration (`buildCarSpec` turns body style
and paint into data; `CarIllustration.tsx` draws it). On top of that, a procedural 3D model built with
three.js and react-three-fiber (no downloaded models) appears on the landing page, the vehicle detail
page, and as a hover turn on showroom cards. It was built on the branch `feat/3d-studio` and merged into
`main` without squashing. Details: [`docs/3d-report.md`](docs/3d-report.md),
[`docs/3d-decisions.md`](docs/3d-decisions.md).

- **Lazy-loaded.** The initial HTML references only the main chunk; no 3D code is fetched until a
  viewer decides to use it.
- **SVG fallback.** The SVG car is shown when WebGL is unavailable, with reduced motion, with Save-Data,
  on low-tier phones, after a render error, and while a lost WebGL context is recovering.
- **Bundle sizes** (gzip -9 of `npm run build`, from `docs/3d-report.md`): initial JavaScript 135,135 B
  (132 KiB), initial CSS 6,527 B; 3D chunks 280,927 B (274 KiB) for every visitor who loads the 3D car;
  post-processing chunk 104,303 B (high-quality tier only); 3D total with post-processing 385,230 B
  (376 KiB). Budgets were under 200 KB and under 700 KB; both passed.
- **Verification.** The WebGL scene cannot run in jsdom, so it was checked in headless Chromium with
  software GL, not on real devices. Frame rates and quality-tier thresholds are unmeasured. The looks are
  recognisable and distinct per body style but not polished (blunt noses, plain truck bed, one wheel design).

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
| 3D | three 0.186.1, @react-three/fiber 9.8.1, drei 10.7.9, postprocessing 6.39.5 | Procedural models, lazy-loaded, exact versions pinned |
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

All captured from the running app (headless Chromium, 1280x800 unless marked 360 px) against the
seeded `cove_dev` database. The landing page and the vehicle detail page render the 3D car; the
showroom cards and the admin dialog use the SVG illustration.

| | |
| --- | --- |
| ![Landing](docs/screenshots/landing.png) | ![Login](docs/screenshots/login.png) |
| Landing page, signed out, with the 3D car | Sign-in form |
| ![Register](docs/screenshots/register.png) | ![Showroom](docs/screenshots/showroom.png) |
| Registration form | Showroom as a buyer |
| ![Search and filters](docs/screenshots/showroom-filters.png) | ![Sold out](docs/screenshots/showroom-sold-out.png) |
| Search text, SUV category and price range applied | Sold-out card with a disabled button |
| ![Vehicle detail](docs/screenshots/vehicle-detail.png) | ![Confirm purchase](docs/screenshots/purchase-confirm.png) |
| Vehicle detail with the 3D car and paint picker | Purchase confirmation dialog |
| ![Purchase success](docs/screenshots/purchase-success.png) | ![My orders](docs/screenshots/orders.png) |
| Purchase complete, stock lowered from 7 to 6 | My orders with the price paid |
| ![Admin dashboard](docs/screenshots/admin.png) | ![Add vehicle](docs/screenshots/admin-add.png) |
| Admin inventory summary and table | Add to inventory dialog |
| ![Mobile showroom](docs/screenshots/mobile-showroom.png) | ![Mobile admin](docs/screenshots/mobile-admin.png) |
| Showroom at 360 px | Admin inventory at 360 px |
| ![404](docs/screenshots/not-found.png) | ![API docs](docs/screenshots/api-docs.png) |
| 404 page | Swagger UI at `/api/docs` |

Not built, so not shown: dark mode.

## Test report

Numbers below come from `npm run test:report`, run on 25 Oct 2026 after the 3D studio was merged and
the report files in `docs/test-report/` were regenerated. They are not edited by hand.

| | Test files | Tests | Statements | Branches | Functions | Lines |
| --- | --- | --- | --- | --- | --- | --- |
| Backend (Vitest + Supertest, real PostgreSQL) | 41 | 383 passed | 99.26% | 96.81% | 99.46% | 99.6% |
| Frontend (Vitest + Testing Library + MSW) | 27 | 366 passed | 92.17% | 86.2% | 90.88% | 93.09% |

Total: 749 tests, all passing.

Backend coverage excludes the two command-line entry points (`src/server.ts`, `src/seed/run.ts`) and the
generated Prisma client. `src/server.ts` was checked by running it: it starts, logs, and shuts down
cleanly on SIGINT. The backend run enforces a 90% threshold on services, controllers and middleware and
passed.

**Frontend coverage excludes the WebGL render components** (`CarModel`, `Hotspots`, `HoverCar`,
`HoverStage`, `PostFX`, `StudioLights`, `StudioScene` in `frontend/src/studio/`, listed with the reason
in `frontend/vite.config.ts`). They need a WebGL context, which jsdom does not provide, so they cannot run in
a unit test. They were verified by running the app in a real browser (headless Chromium with software
GL, see [3D studio](#3d-studio) and `docs/3d-report.md`), not by automated tests. The pure 3D helpers
(geometry, quality tiers, intro, purchase moment, refinement, and so on) and every other file stay in the
numbers above. The frontend has no coverage threshold; the number is reported, not enforced. For
comparison, before the 3D work the frontend figure was 91.16% statements with 171 tests.

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
- **Accessibility, real browser:** the 3D branch ran axe-core (WCAG 2.0/2.1/2.2 A and AA plus best
  practice, colour contrast included) in headless Chromium on the landing page, showroom, two detail
  pages and admin at 375 px and 1280 px, with no violations and no horizontal overflow at 375 px
  (`docs/3d-report.md`).
- **Accessibility, manual:** no screen reader pass has been done.
- **Bundle:** see the [3D studio](#3d-studio) section for gzip sizes of the initial and 3D chunks.
  Self-hosted font files load on demand.
- **Lighthouse, LCP, INP, CLS:** **not measured.** No numbers are given because none were taken.

## My AI Usage



Tools I used



I used Claude on claude.ai as my advisor for the whole build. It helped me write the phased build prompt (MASTER\_PROMPT.md), fix my Windows setup (PowerShell, a silent Postgres install, git quirks), and it reviewed each phase report before I accepted it.



For the actual building I used Claude Code. I used Opus for the first planning phase and Sonnet for everything after that, mostly to save usage. I also installed gstack, a skill pack for Claude Code. Its headless browser was used to click through the real app, and its design-review and QA skills were run on the 3D branch at phone and desktop widths. I stayed away from its /ship command because it commits on its own and would have flattened my red-green history.



How I worked with it



I kept the kata text in KATA.md and wrote a phased plan with a check at the end of each phase: setup, auth, vehicles and inventory, frontend, hardening and docs, then 3D last. When the plan didn't fit my situation I overrode it. The biggest one was no Docker, because Docker and WSL had broken my PC before, so I ran PostgreSQL natively. I put those overrides in CLAUDE.md so every new session started with the same rules.



For TDD, the rule was that every test had to be seen failing for the right reason before it was committed, and the whole suite had to pass before the code commit. For the first two phases I made every commit myself after reading the message. Once the pattern was solid, I let Claude Code commit under fixed rules (no amending, squashing, rebasing or pushing) and I checked the history afterwards, including that every commit has the co-author line.



I started a fresh session for each phase and exported each transcript before clearing it, which is where PROMPTS.md comes from. The hardening/docs phase and the 3D studio ran overnight while I slept. I set the rules beforehand: never push, never rewrite history, log every decision in docs/3d-decisions.md, and keep the 3D on its own branch so main couldn't break. In the morning I looked at the 3D in the browser myself before merging it.



Things I decided or checked myself



The first commit messages Claude drafted said things like "I reviewed the constraints" and "I ran the suite" when the AI had done those things, not me. I rewrote them so every message is true, and for one of them I ran the tests myself so the line became true.



Claude had a rule of not using packages less than two weeks old. I chose to break it for zod and Prisma because the older versions had high-severity security advisories.



I had the database schema commit relabelled from feat to build, because a feat with no failing test before it looks like a TDD violation.



When middleware coverage was at 80%, I added the 90% thresholds only for the layers that already met them, and added middleware later after the error-handling work, so CI never went red.



I set the order of what to cut if I fell behind, kept 3D until the core was finished, and asked for a public landing page when I noticed the app opened straight onto the login screen.



Claude never tested the admin pages in a real browser because it won't type in credentials, so I did that by hand: add, edit, restock and delete a car, plus checking the Purchase button is disabled when a car is sold out.



The kata only says delete and restock are admin-only. I decided create and update should be admin-only as well, and had the reasoning written up in ADR 0001 so it's explained rather than hidden.



The 3D cars came out recognisable but not beautiful. I merged them anyway because without WebGL the app falls back to the 2D drawings, the bundle stayed within budget, and every test still passed.



What the tests caught



The search tests found a real bug: Prisma's contains doesn't escape % or \_, so searching for % matched every car (fixed in b0609ed).



The race test was proven rather than assumed. A deliberately naive version let 10 buyers take 3 cars; the real version lets exactly 3 through (6bdd9ff, bf39c7d).



A test walks every real route and fails if one isn't covered by the access policy (862148a, 27f338d).



One test passed on my fast Windows machine but failed on GitHub's Linux runner. It was reproduced by slowing the fake API down by 300 ms and fixed by waiting properly for the table row, without making the test weaker (43e2ba5).



Losing the WebGL context left the 3D viewer stuck and froze the tab on fast machines (fixed in eb2366e). A colour bug only showed up in a real browser, not in the tests (876962f).



Where the AI was wrong



It told me to choose a Postgres password during install, but the winget install is silent and never asks, so my first logins failed.



It said git commit -F keeps blank lines. It doesn't. By default git collapses them, which would have broken the co-author format the kata asks for. The fix was adding --cleanup=verbatim.



It wrote search tests expecting the wrong order (corrected in 1c0da72, kept as its own commit instead of rewriting history).



One code commit went in with a failing test (bc3c22f, fixed in 0a7a214), and a few commit messages have the wrong test count. I left them in, because the history is supposed to be real.



It reported the noisy test output as fixed when it wasn't, and the original build plan assumed Docker.



Reflection



The biggest change for me was that I spent most of my time deciding and checking instead of typing. AI let me build something much bigger than I could have alone in a day, but it was most dangerous exactly when it sounded most sure of itself. The git blank-line thing and the fake "I did this" lines would both have ended up in my submission if I hadn't checked. Letting it run overnight only felt okay because I had set hard rules first and kept the risky work on a separate branch. Near the end the tools themselves failed on me (the auto-approval service went down and the API got overloaded), which taught me not to leave things like screenshots for the last few hours. Next time I'd review smaller pieces as they come in, and do the human-only jobs earlier.



Parts of this section were drafted with Claude from my notes and what actually happened during the build, then checked and edited by me.

## Known limitations and what I would do next

Honest list, roughly in order of importance:

1. **No Lighthouse/LCP/INP/CLS numbers and no screen-reader testing.** Only automated axe in jsdom.
2. **The 3D cars are rough.** They are recognisable and distinct per body style but not polished, were
   only checked with software GL, and frame rates are unmeasured on real devices. Not built from the
   original brief: the scroll-scrubbed hero camera, ambient 3D scenes on the 404 and auth pages, and a 3D
   preview in the admin form. ([ADR 0005](docs/adr/0005-svg-cars-now-3d-later.md) records the original
   SVG-first decision; the 3D studio followed on its own branch.)
3. **No dark mode.** Only the light theme exists.
4. **Registration reveals which emails exist** (409), and has no per-route rate limit. See
   [ADR 0002](docs/adr/0002-auth-strategy.md).
5. **Rate limiters are in memory and per process.** They reset on restart and do not share counts across
   instances. Behind a reverse proxy, Express must be told to trust it (`trust proxy`), which is not
   configured, so all clients would share the proxy's address.
6. **Access tokens cannot be revoked before they expire** (15 minutes), and a double refresh from two
   tabs at the same instant can sign the user out.
7. **No deployment.** Nothing is hosted; there is no live link. Cross-site hosting would need
   `SameSite=None; Secure` cookies and a CORS entry for the frontend origin.
8. **No automated end-to-end browser test.** The frontend tests run in jsdom with a mocked network.
   The screenshots and the 3D checks were taken from the running app in a real browser, but none of
   that is a repeatable test.
9. **No restore for soft-deleted vehicles** and no purge.
10. **Search is substring matching** (`ILIKE`), not full-text search; fine for 24 cars, not for a large
    catalogue.
11. **Seed data is invented** (see the notice at the top). Vehicle prices are not real offers.
12. **CI status of the latest commit is not recorded here.** The workflow is in
    `.github/workflows/ci.yml`. It has run on GitHub and caught one test that passed locally and failed on
    Linux (fixed in `43e2ba5`); I have not checked the result for the final commits from this machine.

## Credits and licence

Fonts, icons and artwork are listed in [`CREDITS.md`](CREDITS.md). All code, the logo and the car
illustrations were written for this project. Licence: MIT, see [`LICENSE`](LICENSE).
