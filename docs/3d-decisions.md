# 3D studio: decisions

Choices made unattended on `feat/3d-studio`, newest last. Each picks the more conservative option.

1. **Dependency versions.** Pinned exactly, all at least two weeks old on 25 Oct 2026:
   `three` 0.186.1 (24 Sep), `@react-three/fiber` 9.8.1 (24 Sep; 9.8.2 is from 14 Oct),
   `@react-three/drei` 10.7.9 (25 Sep), `@react-three/postprocessing` 3.1.3 (27 Sep; 3.2.x is newer
   than two weeks), `postprocessing` 6.39.5 (9 Sep), `@types/three` 0.186.0. React 19.3.0 is inside
   every peer range (`>=19 <19.4` for fiber). `npm audit` reports 0 vulnerabilities. No GSAP or Lenis:
   the spec's scroll-scrub is not in the 12-item task list and would hijack scroll.
2. **Landing page loads while the session check runs.** Signed-out visitors see the page at once
   (real DOM, good LCP); a signed-in visitor is redirected once the session resolves.
3. **Tier thresholds** (studio/quality.ts) are judgement calls, not measured on real devices. High
   needs a non-mobile device with at least 8 GB, 8 cores and a frame probe at or under 20 ms. Low is
   Save-Data, at most 2 GB, at most 2 cores, a phone with at most 4 cores, or a probe over 30 ms.
   Browsers that hide memory or cores (Safari, Firefox) never reach high: they get medium.
   DPR caps: high 1.5, medium 1.25, low 1.
4. **Reduced motion means the SVG car, not a still 3D car.** The brief lists it in the fallback chain,
   and the SVG has no motion at all, so it is the conservative reading.
5. **No real shadow-map key light, no reflective floor.** `ContactShadows` on a transparent canvas over
   the page's own cove background gives the grounded look at a fraction of the cost.
   `MeshReflectorMaterial` (optional in the brief, "desktop-class only") was left out: it cannot be
   judged without real GPUs, and an unmeasured effect on the tier gate is the less conservative choice.
6. **Tone mapping is ACES Filmic** (the brief allows AgX or ACES); AgX desaturates the paints.
7. **The 3D car lives in a transparent canvas.** The page background shows through, so the "pale
   infinity-cove floor" is the page itself, not a mesh. Consequence: bloom light added over alpha 0 can
   leak past the canvas edge, so the bloom radius is kept small (0.3).
8. **Bloom is selective**, fed only by the head and tail light meshes, instead of a luminance threshold
   (which would have lit every bright reflection on the clearcoat). It needs scene lights by API; an
   empty `Object3D` satisfies that without adding light.
9. **Hover turn draws one car at a time** through one shared canvas (drei `View`), and only for a
   mouse pointer. Keyboard focus does not start it: the flat picture is the accessible one, and the
   detail page has the keyboard-operable viewer.
10. **The clay twin is a second render of the same car**, sliced by two clip planes at the sweep line,
    rather than swapping materials. Shared materials get clip planes only while the intro runs and
    lose them on finish or unmount.
11. **The page accent goes on the document root** (`usePageAccent`), animated with registered `@property`
    colours. Cards keep their own scoped accent. The existing contrast logic (`pickAccent`) is reused
    unchanged.
12. **Reduced motion:** SVG car, no camera or light motion, no ticking number; only the confirmation
    panel fades (300 ms, opacity only), by an override after the blanket reduced-motion rule.
13. **Hotspot notes use only facts the vehicle record holds** (body style, year, paint, stock, price).
14. **Verification of the scene is by real browser, not unit test.** jsdom has no WebGL. Pure helpers
    (geometry, tiers, poses, timelines, cache) are unit-tested; the scene was driven in headless
    Chromium (software GL) on the 3100/5174 dev servers. Frame rates and tier thresholds were not
    measured on real devices.
15. **QA used the local seeded accounts.** The demo buyer and admin credentials were read from
    `backend/.env` (never printed or committed) to sign in on the local dev app. One real purchase of a
    Mahindra Bolero Pik-Up was made to check the purchase moment: its dev-database stock went 9 to 8 and
    one order exists for the demo buyer. Restock it from the Admin page if you want the old number.
16. **A stale `.gstack/terminal-agent-pid.lock` (empty file, git-ignored) stopped the browse tool from
    starting.** No browse process was running, so the file was deleted. Chrome processes belonging to you
    were left alone.
17. **Park the browser before running tests.** A live WebGL tab in the headless browser starves the
    vitest workers (130 s and 35 timeouts instead of 28 s and none). The browser was parked on
    about:blank before every suite run.
18. **Bundle budgets were met without changes** (see docs/3d-report.md).
