# MASTER PROMPT: Car Dealership Inventory System (TDD Kata)

> Put this file in the project root as `MASTER_PROMPT.md`.
> Then tell Claude Code: **"Read MASTER_PROMPT.md fully. Execute Phase 0 only, then stop and wait for me."**
> After each phase passes its gate, say: **"Gate passed. Execute Phase N."**
> Do not paste the whole thing as one giant task. Phase-by-phase keeps quality high and protects your usage limit.

---

## 0. ROLE

You are a principal full-stack engineer, a creative technologist (real-time 3D), a senior product designer and a strict TDD coach, working as one team. You are building a submission for a hiring assessment. The result must look and feel like a shipped product from a top studio, and its engineering must hold up when a senior reviewer reads the commit history line by line.

Rules that outrank everything below:

1. **The kata requirements are graded first.** Real database, JWT auth, all listed endpoints, admin-only rules, TDD commit history, React + Tailwind + HTML5 + CSS3, search/filter, disabled Purchase at zero stock, admin CRUD UI, README with screenshots, test report, "My AI Usage", PROMPTS.md. Nothing in the 3D or polish layers may ever put one of these at risk. If time runs short, cut polish, never requirements.
2. **Never fabricate.** No fake reviews, fake statistics, fake awards, fake test results, fake coverage numbers, fake screenshots. Every number in the README comes from a real run.
3. **No plagiarism.** Write everything from scratch. No copied repos, templates, or downloaded 3D car models. Any asset that is not authored here (fonts, icons, textures) must be open-licensed and listed in `CREDITS.md`.
4. **I must be able to explain every line in an interview.** After each phase, give me a plain-language walkthrough (max 15 lines) of what was built and why, plus 3 likely interview questions with short answers.
5. Be honest about trade-offs. If something is not done, say so in the final report. Never claim a check passed without running it.

---

## 1. WHAT WE ARE BUILDING

A full-stack Car Dealership Inventory System:

- **Backend**: a RESTful API (Node.js + TypeScript + Express) on a real PostgreSQL database, with JWT auth and role-based access (`USER`, `ADMIN`).
- **Frontend**: a React + Tailwind SPA with a real-time 3D showroom: every vehicle is rendered as a procedurally built, physically-lit 3D car with a Blender-like studio look.
- **Process**: strict Red, Green, Refactor history in Git, AI co-authorship on every AI-assisted commit, transparent AI documentation.

Product name: **propose one short, original name** and use it consistently (README, title, logo). The logo must be an original SVG.

---

## 2. PRIORITY TIERS AND STAGE GATES

Work strictly in this order. Do not start a tier until the previous tier's gate is green.

| Tier | Scope | Gate |
|------|-------|------|
| **P0 Core** | Everything required by the kata, backend + frontend, plain but correct and tested | All endpoints work, all tests green, coverage thresholds met, app runs from a clean clone with documented commands |
| **P1 Craft** | Design system, polish, a11y, states, performance, docs | Lighthouse a11y 100 on main pages, no console errors, README complete |
| **P2 Wow** | 3D showroom, scroll choreography, purchase moment, admin 3D preview | 60 fps on a mid laptop, graceful fallbacks, reduced-motion respected |
| **P3 Extras** | Deploy, e2e suite, extra docs | Only if time remains |

The 3D layer must be built as a **progressive enhancement**: the P0/P1 UI is fully usable without WebGL, and the 3D replaces the static visuals when available.

---

## 3. PROCESS RULES (GIT, TDD, AI DISCLOSURE)

### 3.1 Red, Green, Refactor, visibly

For every behaviour, produce **three separate commits** (refactor only when there is something worth refactoring):

1. `test(scope): <behaviour> [RED]` contains ONLY test code. The suite must fail for the right reason. Run it and show me the failure output before committing.
2. `feat(scope): <behaviour> [GREEN]` contains the smallest code that makes it pass. Run it and show me the green output.
3. `refactor(scope): <what improved>` behaviour unchanged, tests still green.

Use Conventional Commits. Messages are written in my voice, short and specific, with a body that says what the AI did and what I changed or verified. Example:

```
test(vehicles): purchase fails with 409 when stock is zero [RED]

Asked the AI to draft the test cases from the endpoint table, then
tightened the assertions on the error body myself.


Co-authored-by: Claude <noreply@anthropic.com>
```

### 3.2 Hard rules

- **Do NOT run `git commit` yourself.** Stage the files, run the checks, show me the proposed commit message, and wait for me to confirm (I will commit or say "commit it"). Exception: if I explicitly say "you may commit," then commit using the exact format above.
- **Never use `/ship`, auto-commit, squash, or amend** history that has already been recorded. History is evidence.
- **Every AI-assisted commit** ends with two blank lines and the trailer `Co-authored-by: Claude <noreply@anthropic.com>`.
- **Git hooks must not block RED commits.** Do not add a pre-commit hook that runs tests. Linting/formatting hooks are allowed only if they pass on a failing-test commit. Put test enforcement in CI instead.
- Frequent small commits. Target 80+ commits total with a readable story: scaffold, auth, vehicles, search, inventory, hardening, docs, frontend, 3D, polish.
- Branch: work on `main` or short-lived feature branches merged without squash. No force pushes.

### 3.3 PROMPTS.md (raw, unedited)

`PROMPTS.md` in the repo root holds my **raw, unedited** AI chat logs or public links. No AI-generated summaries. I will paste or export the logs myself. Your job: create the file with a short header explaining the format, and remind me at the end of every phase to append that phase's raw conversation. Never write a summary into it.

### 3.4 My AI Usage (README section)

I write this section in my own words. Create the heading and a scaffold with these prompts for me to answer: which tools I used, how I used each one (with concrete examples from this repo), what I verified or rewrote by hand, where the AI was wrong and how I caught it, and my reflection on how AI changed my workflow. Leave `TODO(me)` markers. Do not fill in my reflection for me.

---

## 4. TECH STACK

Before installing anything, run `npm view <pkg> version` for each dependency and **pin exact current stable versions**. Do not rely on memory for versions. Prefer packages that have been published for at least two weeks. Install only from the official npm registry.

**Monorepo layout (simple npm scripts, no heavy tooling):**

```
car-dealership/
  backend/            Express + TypeScript API
  frontend/           Vite + React + TypeScript + Tailwind
  docs/               screenshots/, test-report/, architecture notes, ADRs
  docker-compose.yml  PostgreSQL (dev + test)
  .github/workflows/  CI
  README.md  PROMPTS.md  CREDITS.md  MASTER_PROMPT.md
```

**Backend:** Node.js LTS, TypeScript (strict, `noUncheckedIndexedAccess`), Express, Prisma ORM with PostgreSQL, Zod (validation, env parsing), `jsonwebtoken`, `argon2` (fallback `bcrypt` if native build fails), `helmet`, `cors`, `express-rate-limit`, `pino` + `pino-http`, `swagger-ui-express` + an OpenAPI document generated from the Zod schemas (or hand-written and test-verified), Vitest + Supertest, ESLint + Prettier.

**Frontend:** Vite, React, TypeScript, Tailwind CSS, React Router, TanStack Query, React Hook Form + Zod, `three`, `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing`, GSAP (+ ScrollTrigger), Lenis (smooth scroll), Vitest + React Testing Library, `jest-axe` (or `vitest-axe`), Playwright (P3).

Fonts: self-hosted via `@fontsource` packages (SIL OFL). Display: **Bricolage Grotesque**. Body: **Instrument Sans**. If either fails an accessibility or rendering check, replace it and note why in an ADR. No Google Fonts CDN, no external requests at runtime.

---

## 5. DOMAIN MODEL

Use Prisma. Money is stored as **integer minor units** (never floats). Configure the display currency in one place (`INR` default, formatted via `Intl.NumberFormat`).

```
User            id (uuid), email (unique, lowercased), passwordHash, name, role (USER|ADMIN), createdAt, updatedAt
Vehicle         id (uuid), make, model, category (enum), price (int minor units), quantity (int >= 0),
                year, bodyStyle (enum used by the 3D builder), colorOptions (string[] hex), description,
                createdAt, updatedAt, deletedAt (nullable, soft delete)
Order           id, userId, vehicleId, quantity, unitPrice (snapshot), totalPrice (snapshot),
                vehicleLabel (snapshot "Make Model"), createdAt
InventoryEvent  id, vehicleId, actorId, type (CREATED|UPDATED|PURCHASED|RESTOCKED|DELETED),
                delta (int), quantityAfter (int), createdAt         // append-only audit ledger
RefreshToken    id, userId, tokenHash, expiresAt, revokedAt, replacedById, createdAt
```

Required vehicle fields from the kata: unique ID, make, model, category, price, quantity in stock. Everything else is an enhancement and must never be required by the API contract unless the 3D builder needs a sensible default.

Categories (enum): `HATCHBACK, SEDAN, SUV, COUPE, CONVERTIBLE, TRUCK, EV, SPORTS`. `bodyStyle` maps to a 3D body template, defaulting from the category.

Indexes: `(make, model)`, `category`, `price`, partial index on `deletedAt IS NULL` if supported. Add a CHECK constraint `quantity >= 0` in a migration.

---

## 6. API CONTRACT (build exactly these, plus the extras below)

Base path `/api`. JSON only. All errors use one envelope (RFC 7807 style):

```json
{ "type": "about:blank", "title": "Conflict", "status": 409, "code": "OUT_OF_STOCK",
  "detail": "Only 0 units left.", "requestId": "…", "errors": [{ "field": "quantity", "message": "…" }] }
```

| Method | Path | Auth | Behaviour |
|--------|------|------|-----------|
| POST | `/auth/register` | public | Create `USER`. Never accepts `role`. Email normalised, password policy enforced (min 10 chars, not in a small common-password list). 201 + user (no hash). 409 on duplicate email |
| POST | `/auth/login` | public | Verify credentials in constant-ish time. Returns short-lived access JWT (15 min) in the body; refresh token as `httpOnly; Secure; SameSite=Lax` cookie with rotation + reuse detection. Rate-limited. Generic error message on failure |
| POST | `/auth/refresh` | cookie | Rotate refresh token, return new access token |
| POST | `/auth/logout` | cookie | Revoke the refresh token chain |
| GET | `/auth/me` | JWT | Current user |
| POST | `/vehicles` | JWT, **ADMIN** | Create vehicle. Zod validation. 201 |
| GET | `/vehicles` | JWT | List available vehicles (not soft-deleted). Pagination (`page`, `pageSize` max 50), sort (`sort=price|-price|make|-createdAt`). Returns `{ data, meta: { page, pageSize, total, totalPages } }` |
| GET | `/vehicles/search` | JWT | Query by `q` (make/model, case-insensitive), `make`, `model`, `category`, `minPrice`, `maxPrice`, `inStock`. Same pagination/sort. **Register before `/:id`** |
| GET | `/vehicles/:id` | JWT | One vehicle. 404 if missing or deleted |
| PUT | `/vehicles/:id` | JWT, **ADMIN** | Update vehicle details. See the decision note below |
| DELETE | `/vehicles/:id` | JWT, **ADMIN** | Soft delete. 204. Orders keep their snapshots |
| POST | `/vehicles/:id/purchase` | JWT | Body `{ quantity?: 1 }`. **Atomic.** 200 + `{ vehicle, order }`. 409 `OUT_OF_STOCK` if insufficient. 404 if missing |
| POST | `/vehicles/:id/restock` | JWT, **ADMIN** | Body `{ quantity: positive int }`. 200 + vehicle |
| GET | `/orders/mine` | JWT | Current user's orders |
| GET | `/admin/events` | JWT, **ADMIN** | Recent `InventoryEvent` feed (powers the admin activity panel) |
| GET | `/health`, `/ready` | public | Liveness, readiness (DB ping) |
| GET | `/docs` | public | Swagger UI |

**Decision note to record as an ADR:** the kata says "Protected" for `GET /vehicles` and the other vehicle routes, and "Admin only" for delete and restock. Implement exactly that. Treat `PUT` as admin-only (it is a management action) and write the reasoning in the ADR. Make this a single easy-to-change policy map, not scattered `if` statements.

**Concurrency requirement for purchase:** the decrement must be a single atomic statement guarded by the stock check (for example Prisma `updateMany({ where: { id, quantity: { gte: n }, deletedAt: null }, data: { quantity: { decrement: n } } })` and then check `count === 1`) inside a transaction that also writes the `Order` and the `InventoryEvent`. Prove it with a test that fires N parallel purchases against stock M < N and asserts exactly M succeed and the final stock is 0, never negative.

---

## 7. BACKEND EXCELLENCE (this is what reviewers read first)

**Architecture (SOLID, no shortcuts):** `routes -> controllers -> services -> repositories`. Controllers only parse/validate and shape HTTP. Services hold business rules and depend on repository **interfaces** (dependency inversion). Repositories are the only layer that touches Prisma. Wire dependencies in one composition root (`container.ts`), no hidden singletons. `app.ts` exports a `createApp(deps)` factory so tests can build an isolated app.

**Security:**
- Passwords hashed with argon2id. Never log secrets or tokens. Redact `authorization` and `cookie` in logs.
- JWT: explicit algorithm, `iss`/`aud`/`exp`, secrets from validated env (fail fast at boot if missing or weak). Separate secrets for access and refresh.
- `helmet`, strict CORS allow-list from env, JSON body size limit, rate limit on `/auth/*` (tighter) and globally.
- Role checks centralised in middleware backed by the policy map. No mass assignment: Zod schemas use `.strict()`.
- Account enumeration protection on login and register responses where feasible.
- Admin bootstrap: a seed script reads `ADMIN_EMAIL` / `ADMIN_PASSWORD` from env. Public registration can never create an admin.
- Dependency hygiene: `npm audit` in CI, lockfile committed.

**Quality and operability:**
- Request ID middleware, structured logs, centralised error handler mapping domain errors to the envelope. No stack traces in production responses.
- Graceful shutdown (close server and Prisma on SIGTERM).
- Config in one validated module. `.env.example` committed, `.env` ignored.
- OpenAPI served at `/api/docs`, and a test asserts the documented routes exist.
- Seed script: about 24 realistic vehicles across all categories (real makes/models, prices clearly marked as **demo data** in the README and in a `isDemo` note, never presented as real offers), one admin, one normal user.
- Migrations committed. `npm run db:reset` and `npm run db:seed` work from a clean clone.

---

## 8. BACKEND TDD PLAN (strict order, one RED/GREEN/REFACTOR cycle each)

Test infrastructure first (its own commits): Vitest config, Supertest helper, a **real PostgreSQL test database** (via docker compose, separate schema/db), per-test cleanup (truncate or transaction rollback), factory helpers for users and vehicles. No in-memory DB anywhere.

Then, in this order:

1. Health endpoint.
2. Env/config validation (fails on missing secrets).
3. Register: success, duplicate email, weak password, extra `role` field rejected, hash never returned.
4. Login: success, wrong password, unknown email (same message), rate limit.
5. JWT middleware: missing, malformed, expired, wrong signature, wrong audience.
6. Refresh rotation, reuse detection revokes the chain, logout revokes.
7. Role middleware: USER vs ADMIN matrix as a table-driven test over every protected route.
8. Create vehicle: validation (negative price, non-integer quantity, empty make), admin only.
9. List vehicles: pagination bounds, sorting, excludes soft-deleted.
10. Search: each filter alone and combined, case-insensitivity, price range edges, empty result, invalid range (min > max) returns 400.
11. Get by id: found, not found, malformed uuid returns 400 or 404 consistently.
12. Update: partial update, validation, admin only, 404.
13. Delete: soft delete, hidden from list/search/get, orders retained, admin only.
14. Purchase: success decrements, writes order and event, 409 at zero, 404, quantity > stock, **parallel purchase race test**.
15. Restock: success, non-positive rejected, admin only, writes event.
16. Orders/mine and admin events feed.
17. Error envelope shape, request IDs, no stack leak in production mode.
18. OpenAPI contract test.

**Coverage:** configure thresholds (lines, branches, functions, statements) at **90%+ for services, controllers and middleware**; fail the run under threshold. Generate: `docs/test-report/backend/` (HTML report, JUnit XML, coverage summary). Do not count config/seed files toward the threshold, and say so.

---

## 9. FRONTEND VISION: "THE STUDIO"

### 9.1 Design direction (decide deliberately, avoid templated defaults)

Do a short design plan first (palette of 4-6 named hex values, type roles, layout concept with ASCII wireframes), then critique it against this brief and revise anything that looks like a generic default. Avoid: cream + terracotta + serif, near-black + acid green, identical rounded SaaS cards with the same soft shadow, tracked ALL-CAPS eyebrows above every heading, "01/02/03" numbering on non-sequential content, middle-dot meta strings, arrows appended to every button, one accented word in each headline.

**Concept:** a *photographer's infinity-cove studio*. A pale, softly lit cyclorama floor and wall (warm neutral, not pure white), large soft shadows, and one hero object at a time. It should feel like a Blender material-preview render: clean, physically plausible, calm. The UI chrome stays quiet so the cars carry the page.

**The one memorable idea:** the **page accent colour follows the paint colour** of the car currently in focus. Switching paint on a car shifts the accent used for primary buttons, focus rings, price highlights and subtle background tint (animate with CSS custom properties; always re-check contrast and fall back to a safe accent if a paint fails 4.5:1 for text or 3:1 for UI).

**The one orchestrated moment (on first load of the hero):** the car appears as a flat grey **clay render** with visible wireframe, then transitions to full **material preview** (paint, glass, tyres, lights) with a short light sweep, echoing Blender's viewport shading modes. Play once per session. Everything else is restrained, and motion elsewhere responds to user actions rather than decorating.

### 9.2 Design tokens

All tokens are CSS variables and Tailwind theme extensions: colours, type scale (modular), spacing, radius (use **two** radii with intent, not one everywhere), elevation (shadows that reflect the studio light direction), motion durations/easings. Support light as the default and a **dark "night studio"** variant via `prefers-color-scheme` plus a manual toggle that persists. Text 4.5:1, UI 3:1 (WCAG 2.2 AA), checked for hover, focus, disabled and on-image states.

### 9.3 Copy

Write specific, plain, active-voice copy. Buttons say what happens ("Buy this car", "Add to inventory", "Restock 5 units"). Errors say what went wrong and how to fix it, without apologising. Empty states invite an action. No lorem ipsum, no fake testimonials, no "#1 dealership" style claims, no fake urgency. A "Low stock" badge is allowed **only** because it is computed from real `quantity` (for example at 3 or fewer).

---

## 10. 3D AND MOTION SPECIFICATION

### 10.1 Procedural cars (no downloaded models)

Build a `CarModel` component driven by a pure, unit-tested function `buildCarSpec(bodyStyle, overrides)` that returns dimensions (length, width, height, wheelbase, ground clearance, cabin start/end, wheel radius, bonnet and roof curves). The component turns the spec into geometry:

- Body: an **extruded side-profile shape** (smooth Bezier/spline curves) with bevel, then width-tapering via a vertex pass, plus separate meshes for glass (dark, glossy, slightly transparent), lower sill, bumpers, grille, mirrors, door seams (thin inset lines), badges (abstract, no real brand marks).
- Wheels: tyre (torus with sidewall profile), rim (lathe + spokes), brake disc. Wheels rotate with a speed prop, and steer slightly during interaction.
- Lights: emissive headlights and tail lights with a subtle bloom, toggled by a control.
- Materials: `MeshPhysicalMaterial` with **clearcoat**, metalness/roughness tuned per part, flake via a procedural normal/noise texture generated in code (no image files). Paint is a prop (hex) and animates between colours.
- Body styles needed: hatchback, sedan, SUV, coupe, convertible, truck, EV (smooth, no grille), sports (low and wide). Distinct silhouettes, not recolours.
- Unit-test `buildCarSpec` (dimensions sane, wheelbase < length, cabin within body, all styles produce valid specs).

### 10.2 Studio look (Blender-like)

- Lighting from **drei `Lightformer`** area lights inside `Environment` (no external HDRI downloads), plus one key shadow-casting light. Warm key, cool rim, soft fill.
- Tone mapping Filmic/AgX (or ACES) with sensible exposure. sRGB output. MSAA or SMAA.
- Soft ground shadows (`AccumulativeShadows` or `ContactShadows`), and a faint floor reflection (`MeshReflectorMaterial`, low resolution, only on desktop-class GPUs).
- Post-processing kept light: N8AO or SSAO (subtle), bloom for emissive parts only, gentle vignette. Optional depth of field only on the detail view. All effects gated by a quality tier.
- Camera: perspective, 35-50 mm equivalent FOV, smooth damped orbit, polar angle limits so users never go under the floor.

### 10.3 Scenes and interactions

1. **Hero**: a hero car on a turntable. Scroll scrubs the camera along a path (3/4 view, side profile, front, close-up on a wheel, rear) using GSAP ScrollTrigger + Lenis, with text panels that fade in beside the car at each stop. Paint swatches change colour live. The clay-to-material intro plays once.
2. **Showroom grid**: **one shared WebGL canvas** using drei `<View>` (or snapshot rendering), never one canvas per card. Cards show each car; on hover the car rotates and wheels spin; off-screen cards pause rendering. Card layout is a clean responsive grid with search and filters above it.
3. **Vehicle detail** (route or drawer): full orbit controls, auto-rotate that stops on interaction, paint switcher, light toggle, wheel spin, hotspot annotations (CSS2D or drei `Html`) that open short spec notes, price, stock, and the Buy button. Keyboard accessible alternative: arrow keys rotate, and a "view" select (front, side, rear, top).
4. **Purchase moment**: on success, the car does a short camera pull-back, a soft light sweep, the stock count animates down, and a confirmation panel shows the order. No confetti. Respect reduced motion (replace with a simple fade and a clear message).
5. **Auth pages**: a calm, low-cost ambient scene (single slowly rotating car under a spotlight) or a pure CSS equivalent on low-tier devices. Forms stay fast and fully accessible.
6. **Admin**: deliberately calm and fast. No heavy 3D except a small live **preview inside the vehicle form** that updates body style and colour as the admin edits fields.
7. **404 page**: an on-brand scene (the car with a flat tyre, or a "wrong turn" sign), with links home and to the showroom.

### 10.4 Performance and fallbacks (non-negotiable)

- The 3D code is **lazy-loaded** in its own chunk. The initial route renders meaningful HTML first. The LCP element is real DOM content (headline plus a static poster image/SVG of the car), never the canvas.
- Quality tiers (`low`, `medium`, `high`) chosen by device memory, hardware concurrency, `devicePixelRatio`, screen size and a quick frame-time probe. Cap DPR (1.5 on high, 1 on low). Disable reflections, AO and bloom on low.
- `frameloop="demand"` when nothing animates. Pause rendering when the tab is hidden or the canvas is off-screen (IntersectionObserver). Dispose geometries, materials and textures on unmount. Reuse geometries and materials across cars via a cache.
- **Fallback chain:** no WebGL, low tier on mobile, `prefers-reduced-motion`, `Save-Data`, or an error boundary around the canvas shows a static, good-looking 2.5D illustration (inline SVG generated from the same `buildCarSpec` profile, with CSS-driven paint colour). The site must never look broken without WebGL.
- Handle WebGL context loss and restore.
- Budgets: initial JS (before 3D chunk) under 200 KB gzip, 3D chunk under 700 KB gzip, LCP 2.5 s or less, INP 200 ms or less, CLS 0.1 or less on a mid-range mobile profile. Report real measured numbers in the README.
- Scroll choreography must not hijack native scroll semantics: keyboard scrolling, anchor links, and screen readers still work. Provide a "Skip animation" control.

---

## 11. FRONTEND FEATURES AND PAGES

**Routes:** `/` (hero + featured), `/showroom` (all vehicles), `/vehicles/:id`, `/login`, `/register`, `/orders` (my purchases), `/admin` (inventory dashboard, protected), `/privacy`, `/terms`, `/accessibility`, `/credits`, `*` (custom 404). Route guards redirect unauthenticated users to login and return them to where they were. Non-admins see no admin UI and get a clear 403 page if they navigate there.

**Showroom:**
- Debounced search box (make/model), category chips, price range (dual-handle slider, keyboard accessible, shown with formatted currency), "In stock only" toggle, sort select, pagination or infinite scroll.
- **Filters live in the URL** so views are shareable and the back button works.
- Result count announced via `aria-live`. Skeleton cards while loading, an empty state with "Clear filters", and an error state with Retry.
- Each card: 3D view, make + model, category, formatted price, stock state. **Purchase button is disabled when quantity is 0**, labelled "Sold out", with an accessible explanation (`aria-disabled` plus visible text), not just a greyed look.
- Purchase flow: confirm dialog (focus trapped, Escape closes, focus returns), optimistic stock update with rollback on 409, toast with the real result.

**Admin dashboard:**
- Summary tiles (total vehicles, units in stock, low stock, sold out) with count-up on first view only.
- Inventory table: sortable, searchable, keyboard-navigable, responsive (cards on mobile).
- Add and edit via modal form (React Hook Form + Zod schema shared in spirit with the backend), live 3D preview, field-level errors, loading, success, failure with retry. Delete with a confirmation that names the vehicle. Restock with a quantity stepper.
- Activity feed from `/admin/events`.

**Auth UX:** register and login forms with visible labels, correct `autocomplete`, show/hide password, password strength hint, inline errors linked by `aria-describedby`, loading state that prevents double submit, a clear success path. Access token kept **in memory only**, refresh via the httpOnly cookie, silent refresh on 401 once, then log out cleanly. Never store tokens in `localStorage`.

**Data layer:** typed API client, TanStack Query with sensible stale times, request cancellation on filter change, global error handling that maps the backend envelope to user messages.

---

## 12. QUALITY FLOOR FOR EVERY PAGE

Adapted from the Master Website Prompt, applied to this app.

**Accessibility (WCAG 2.2 AA):** one `<h1>` per page and logical headings; landmarks (`header`, `nav`, `main`, `footer`); "Skip to main content" link; visible focus on everything interactive; no keyboard traps; touch targets 44x44 px or more; labels on every control; required fields marked in text; errors announced; dialogs trap and restore focus; meaningful alt text or `aria-label` for 3D canvases (describe the car, colour and key specs) with the canvas itself `role="img"`; decorative layers `aria-hidden`; text resizes to 200% and reflows at 320 px; `lang` set; `prefers-reduced-motion` honoured everywhere; never disable zoom; safe-area insets respected. Run `axe` in tests on every page.

**Responsive:** mobile-first at 360, 480, 768, 1024, 1280, 1536. No horizontal scroll at any width. Working mobile menu (aria-expanded/controls, closes on Escape, outside tap and link click). Sticky mobile "Buy"/"Browse" CTA on the detail and hero pages that does not cover content or toasts.

**States:** every button has hover, focus, active, disabled and loading states. Every async view has skeleton, empty, error-with-retry and success states.

**Navigation and links:** no dead links, no `#` hrefs, no buttons that do nothing. Logo links home. `aria-current="page"` on the active nav item. Footer: dynamic copyright year, product name, Privacy, Terms, Accessibility, Credits, Cookie note, Contact (a real `mailto:` placeholder clearly marked `[PLACEHOLDER]` for me to fill). Run a link crawl at the end and fix every broken link.

**SEO and sharing:** unique `<title>` and meta description per route (via a small head manager), canonical URLs, Open Graph + Twitter tags with an original 1200x630 share image generated from the 3D scene or SVG, favicon set (SVG, ICO, apple-touch 180, 192 and 512 icons, `theme-color`, web manifest), `robots.txt`, `sitemap.xml` for public routes, `noindex` on auth, admin and order pages, JSON-LD (`Organization`, `WebSite`; `Product`/`Car` only for visible, true data, and never with invented ratings).

**Privacy and legal (lightweight, honest):** this is a demo project, so say so. Draft Privacy, Terms and Accessibility pages in plain language with effective and last-updated dates, stating what is collected (email, name, orders), why, retention, the single strictly necessary cookie (refresh token), and how to request deletion (an `/privacy#delete` section and a documented mailto). No analytics, no trackers, no third-party embeds, so no consent banner is required. If any non-essential storage is ever added, add a compliant banner (equal Accept/Reject, no pre-ticked boxes) first. Flag that a lawyer should review before any real-world use. Do not claim legal compliance.

**Honest UX:** no fake urgency, no dark patterns, no hidden fees, no confirm-shaming. The price shown is the price charged. "Purchase" here is a simulated inventory action: say so clearly in the UI footer and README (no real payments, no real cars).

**Images and IP:** no copyrighted car photos or brand logos. Cars are procedural, badges are abstract originals. Every font and icon is listed in `CREDITS.md` with source, licence and URL, and shown on `/credits`.

---

## 13. FRONTEND TESTING

- Unit: `buildCarSpec`, price/currency formatters, filter-to-URL serialisation, quality-tier selection, auth token helpers.
- Component (React Testing Library): login and register validation, the Purchase button disabled at zero stock, filter interactions, admin form validation, confirm dialogs, error boundary fallback when WebGL is unavailable (mock it).
- Accessibility: `axe` on each route in both themes.
- Integration: MSW to mock the API for loading, empty, error and 409 flows.
- P3: one Playwright happy path (register, login, search, purchase, admin restock) and a mobile viewport smoke test.
- Generate `docs/test-report/frontend/` (HTML + JUnit + coverage). Coverage target 80%+ for non-3D code. State plainly that WebGL rendering itself is verified manually plus via fallback tests.

---

## 14. DEVEX, CI, DEPLOY

- `docker-compose.yml`: PostgreSQL for dev and for tests, healthchecks, named volume.
- Root scripts: `npm run setup`, `dev`, `test`, `test:coverage`, `db:reset`, `db:seed`, `lint`, `typecheck`, `build`. A new reviewer should go from clone to running app in **under 5 minutes** by following the README exactly. Verify this by actually following it in a clean directory.
- GitHub Actions: install, lint, typecheck, test with Postgres service, coverage upload as an artifact, build, `npm audit --omit=dev` (report, fail on high/critical).
- Optional P3 deploy: frontend on Vercel or Netlify, backend plus Postgres on Render or Railway. Document env vars, CORS, and cookie settings for cross-site deployment (`SameSite=None; Secure` if the origins differ), and include the live link in the README only when it really works.

---

## 15. DOCUMENTATION DELIVERABLES

**README.md** (written for a skeptical hiring reviewer) must contain, in this order:

1. Name, one-paragraph explanation, a hero screenshot or GIF.
2. Feature list mapped to the kata requirements (a checklist table showing each requirement and where it lives in the code).
3. Architecture overview with a diagram (Mermaid) and the key decisions (link to ADRs in `docs/adr/`).
4. Tech stack and why.
5. Local setup: prerequisites, clone, env files, DB start, migrate, seed, run backend, run frontend, default seeded accounts, how to run tests. Copy-paste commands.
6. API reference summary (link to `/api/docs`) with example requests.
7. Screenshots of the final app: home hero, showroom with filters, vehicle detail, purchase success, admin dashboard, mobile views, 404, dark mode. Real captures stored in `docs/screenshots/`.
8. **Test report**: real numbers from real runs (tests passed, coverage per package), a link to the HTML reports, and a short note on how TDD was applied, referencing example Red/Green/Refactor commit hashes.
9. Performance and accessibility results (Lighthouse and axe numbers measured on the final build, with the device/profile used).
10. **My AI Usage** (scaffold for me to write, see 3.4).
11. Known limitations and what I would do next (honest list).
12. Credits and licence.

Also create: `docs/adr/` with short ADRs (auth strategy, soft delete, atomic purchase, 3D approach and fallbacks, PUT admin-only decision), `CREDITS.md`, `.env.example` files, and `docs/INTERVIEW_NOTES.md` listing the 15 most likely interview questions about this codebase and my honest answers drawn from the actual implementation.

---

## 16. PHASES (execute one at a time, stop at each gate)

**Phase 0: Plan (no code).**
Restate the brief in 8 lines, list assumptions, propose the product name, show the final folder tree, the commit plan, the design plan (palette, type, layout wireframes, critique and revision), and the risk list. Ask at most 3 blocking questions. Create `CLAUDE.md` project rules from sections 0 and 3. Stop.

**Phase 1: Foundation.**
Repo init, tooling, strict TS, lint/format, docker-compose Postgres, Prisma schema + migration, test infrastructure, CI skeleton, `.env.example`, README skeleton. Commits follow the rules but tests-first applies from Phase 2 onward. Gate: `npm run test` runs (even with one trivial passing test), app boots, DB connects.

**Phase 2: Backend core via strict TDD.**
Plan items 1-7 of section 8 (health, config, auth, JWT, refresh, role matrix). Gate: coverage over 90% for the touched layers, the Red/Green/Refactor log is visible in `git log --oneline`.

**Phase 3: Vehicles and inventory via strict TDD.**
Plan items 8-18. Includes the race test. Gate: all kata endpoints complete, OpenAPI served, coverage thresholds pass, seed works, manual curl smoke test documented.

**Phase 4: Frontend P0 and P1 (no 3D yet).**
Design tokens, layout, auth, showroom with filters, detail, purchase flow, admin CRUD, all states, a11y, SEO basics, tests. Cars shown as the SVG 2.5D illustrations generated from `buildCarSpec`. Gate: the whole kata works end to end in the browser, axe clean, Lighthouse measured.

**Phase 5: The 3D studio (P2).**
`CarModel`, studio lighting, hero scroll choreography, shared-canvas grid, detail orbit, purchase moment, admin preview, quality tiers, fallbacks, performance budgets. Gate: 60 fps target on a mid laptop, fallback tests pass, reduced motion works, bundle budgets reported.

**Phase 6: Hardening and documentation.**
Link crawl, cross-browser smoke, mobile pass at every breakpoint, security review of the backend (`/cso` or a manual checklist), real screenshots, test reports, README completion, ADRs, interview notes, credits. Gate: the final self-check below is fully reported.

**Phase 7 (optional): Deploy and e2e.**

At the end of every phase output: what was built, how to verify it, the phase gate result with evidence, the walkthrough and interview questions (rule 4), and a reminder to append the raw chat to `PROMPTS.md`.

---

## 17. FINAL SELF-CHECK (report pass/fix with evidence, do not just tick boxes)

**Kata requirements**
- [ ] Real DB (PostgreSQL), not in-memory
- [ ] Register and login work, JWT protects routes, role rules enforced
- [ ] All listed endpoints exist and behave as specified, including search
- [ ] Delete and restock are admin only, enforced server-side and hidden client-side
- [ ] Purchase is atomic and race-tested, never goes below zero
- [ ] Each vehicle has unique ID, make, model, category, price, quantity
- [ ] Frontend uses HTML5, CSS3, Tailwind, React
- [ ] Register/login forms, dashboard, search/filter, Purchase disabled at zero, admin add/update/delete UI
- [ ] Visible Red, Green, Refactor history, frequent descriptive commits
- [ ] Co-author trailer on every AI-assisted commit
- [ ] README: explanation, setup (backend + frontend), screenshots, **My AI Usage**, test report
- [ ] `PROMPTS.md` with raw logs (no summaries)
- [ ] Public repo link ready (and deploy link if built)

**Engineering**
- [ ] Layered architecture, interfaces, composition root
- [ ] Coverage thresholds met and reported with real numbers
- [ ] No secrets in repo, `.env.example` present, `npm audit` reviewed
- [ ] Error envelope consistent, no stack leaks, request IDs
- [ ] CI green from a clean clone
- [ ] Clean clone to running app verified in under 5 minutes

**Frontend and experience**
- [ ] No horizontal scroll at 360 px, all breakpoints checked
- [ ] Mobile menu, sticky mobile CTA, safe areas
- [ ] Contrast passes in light and dark, focus visible, keyboard complete
- [ ] axe clean on every route
- [ ] Skeleton, empty, error and success states everywhere
- [ ] 404 page, favicon set, unique titles and descriptions, OG image, robots.txt, sitemap.xml
- [ ] Footer links all real, dynamic year, logo/mail links work
- [ ] No lorem ipsum, no fake claims or reviews, placeholders listed
- [ ] Credits page and `CREDITS.md` complete, nothing copyrighted
- [ ] Privacy, Terms, Accessibility pages present with demo-project disclaimer
- [ ] 3D lazy-loaded, fallbacks work (no WebGL, reduced motion, low tier), context loss handled
- [ ] LCP, INP, CLS and bundle budgets measured and reported honestly

Then output two lists:

1. **Needs my input:** every `[PLACEHOLDER]` and what I must supply (contact email, repo URL, my name, deployed URL, my own words for "My AI Usage").
2. **Only I can do:** push to a public repo, append raw chats to `PROMPTS.md`, write my reflection, take or approve final screenshots, deploy accounts, and rehearse the interview using `docs/INTERVIEW_NOTES.md`.
