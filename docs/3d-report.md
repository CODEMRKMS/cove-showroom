# 3D studio: final report

Branch `feat/3d-studio` (from `main` after the landing page). Written 25 Oct 2026, unattended.

## Commits

**On `main` (2):**

- `24524f0` test(landing): public landing page at "/" for signed-out visitors [RED]
- `c93a444` feat(landing): public landing page at "/" [GREEN]

**On `feat/3d-studio` (34 beyond main, plus this docs commit)**, in RED / GREEN / refactor order:
dependencies `227563a`; geometry helpers `15f0391`/`e557eb3`; tiers `682d8e6`/`d6289fe`; CarViewer and
fallbacks `4566860`/`301c497`; window, seam and light placement `abc1b48`/`0f3c118`; camera poses, paint
easing, flake, cache `37588ff`/`ce754e5`; body/glass/tyre/rim geometry `ad88669`/`bdd827f`/`a2a201b`;
scene and model `ac58368`; detail page `bb76951`, refactor `a291c31`, `7687f15`; look fix `f0120c0`;
hotspots `4103f40`/`246cc6a`; intro `d8ef6a4`/`03c1b33`/`b42b46d`; page accent `934352c`/`325c669`;
purchase moment `5ebe9b4`/`c833a38`; post-processing `8fc16ca`; extraction refactor `3071c71`; hover turn
`30e01f4`/`ed3199b`; context-loss fix `eb2366e`. `git log --oneline main..feat/3d-studio` lists them all.
Every commit used `git commit --cleanup=verbatim -F .git/cove-msgs/<n>.txt` (125 to 160). Nothing was
pushed, amended, squashed or rebased.

## Test results

- Frontend (vitest, jsdom, MSW): **27 files, 366 tests passed** at the last run; `tsc --noEmit`,
  `eslint .` and `prettier --check` clean. Before this work: 15 files, 171 tests.
- Backend untouched; its suite was not re-run.
- Not unit-testable here: the WebGL scene itself (jsdom has no GL). Covered by real-browser checks below.
- Real-browser checks (headless Chromium, software GL, dev servers on 3100/5174):
  - 3D hero and detail render; six body styles seen in 3D (GR Supra, Bolero, Mini, Z4, Nexon EV, Emira),
    silhouettes distinct; View select; hotspot buttons; clay-and-wireframe intro with Skip intro;
    purchase with the confirmation panel; high-tier post-processing; one canvas on the showroom and one
    3D car on hover; reduced motion shows the SVG only; WebGL context loss and restore (found and
    fixed a bug, see `eb2366e`).
  - axe-core (wcag2a/aa, 2.1 aa, 2.2 aa, best practice; colour contrast included) run in the real
    browser on landing, showroom, two detail pages and admin at 375 px and 1280 px: **no violations**.
  - No horizontal overflow at 375 px. No console errors except the expected 401 of the signed-out
    session check and a "THREE.Clock deprecated" warning that comes from react-three-fiber.
  - /design-review and /qa style passes found one real defect (context loss). Nothing else needed a
    code change; layout, contrast and focus were fine at both widths.

## Bundle sizes (gzip -9 of `npm run build` output)

| Part | gzip | Budget |
| --- | --- | --- |
| Initial JS (`index-*.js`) | 135,135 B (132 KiB) | under 200 KB |
| Initial CSS | 6,527 B | |
| 3D chunks, every 3D visitor (three + fiber + drei core 237,205; shared geometry/model 28,013; scene 9,808; View 1,968; fiber 2,177; hover 1,756) | 280,927 B (274 KiB) | under 700 KB |
| Post-processing chunk (high tier only) | 104,303 B | |
| 3D total with post-processing | 385,230 B (376 KiB) | under 700 KB |

The initial HTML references only the index chunk (no modulepreload), so no 3D code is fetched until a
viewer decides to use it. Both budgets pass; no fix was needed.

## What works

- Landing page at "/" (signed out; signed-in visitors go to the showroom).
- Lazy `CarViewer` with the full fallback chain: no WebGL, reduced motion, Save-Data, low-tier phone,
  error boundary, context loss and restore.
- Quality tiers with capped DPR, `frameloop="demand"`, off-screen and hidden-tab pause, a shared resource
  cache with disposal.
- Procedural cars for all eight body styles from `buildCarSpec`.
- Detail page: specs, paint swatches, hotspots, purchase, and a keyboard/select viewer.
- Clay-to-render intro (once per session, skippable), page accent that follows the paint, purchase moment,
  post-processing on the high tier, one-canvas hover turn on showroom cards.

## What is unfinished or weak

- **Looks:** noses are blunt, the truck bed is a plain dark panel, windscreens are slabs, all wheels are
  one design. Recognisable and distinct, not beautiful. No contact shadow is clearly visible in screenshots.
- **Thresholds and frame rates are unmeasured on real devices**; software GL only.
- The eased accent transition was verified by computed style, not by an intermediate sample.
- Not built: the scroll-scrubbed hero camera (GSAP/Lenis) from MASTER_PROMPT (it was not in the task list),
  the 404 and auth-page ambient scenes, and the admin form's 3D preview.
- README, test report and screenshots were not updated for the 3D work; `PROMPTS.md` was not touched.
- A few earlier commit messages state test counts that were slightly off (for example "325 tests" where
  the run said 334, "three failures" where two failed). The numbers in this report are from final runs.
- Hover turn: keyboard focus does not start it (decision 9).

## Decisions

All in `docs/3d-decisions.md` (18 entries).

## How to view it

```
cd backend && PORT=3100 npm run dev
cd frontend && API_PROXY_TARGET=http://localhost:3100 npx vite --port 5174
```

Open http://localhost:5174/ signed out. The hero intro plays once per browser session; clear
sessionStorage to see it again. Sign in, open the showroom (hover a card), then "View details" on any car.

## How to merge it

```
git switch main
git merge --no-ff feat/3d-studio
cd frontend && npm ci && npm test && npm run build
```

Never squash: the RED/GREEN history is evidence. CLAUDE.md's gate for Phase 5 applies: Phases 1 to 4 and 6
were already green on `main`; run the full suite and a visual pass first. If you do not like the look, leave
the branch unmerged: `main`, with the landing page, is complete and safe on its own.
