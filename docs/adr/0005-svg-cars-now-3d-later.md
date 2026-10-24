# ADR 0005: Cars are 2D SVG illustrations now; a 3D studio is a separate, optional step

- Status: accepted
- Date: 2026-10-25

## Context

`MASTER_PROMPT.md` describes an ambitious real-time 3D studio (Phase 5). The kata itself grades the
backend, the TDD history, the forms and the documentation, and the deadline is fixed (3 pm IST,
25 Oct 2026). Three.js or similar would add large dependencies, a WebGL fallback path, a performance
budget and a lot of manual verification that automated tests cannot do (jsdom has no WebGL).

## Decision

1. **Phase 4 ships cars as hand-drawn SVG.** `frontend/src/lib/carSpec.ts` turns a vehicle's body style
   and paint into a plain data object (`buildCarSpec`: eight body templates, wheel positions, roof and
   bed flags). `components/CarIllustration.tsx` renders that object as an SVG: a side view with a floor
   shadow and an ellipse on each wheel for a hint of depth. It is original work, with no downloaded
   models or images (see `CREDITS.md`).
2. **No 3D dependency exists on `main`.** There is no `three` and no `@react-three/*`. The runtime
   dependencies are React, React Router, TanStack Query, Zod and the two self-hosted fonts.
3. **3D, if it happens, comes later on its own branch** (`feat/3d-studio`), after everything the kata
   grades is finished and green, and is merged only if its own gate passes. It would render the same
   `CarSpec` as a procedural 3D model, so the data layer would not change and the SVG would remain as
   the fallback for no WebGL, reduced motion and low-power devices.

## Why the split is at `CarSpec`

`buildCarSpec` is pure and unit tested (`carSpec.test.ts`). Both renderers would consume the same
object, so the 3D work adds a renderer and does not alter the product, and the SVG view stays as the
always-works path.

## Consequences

- Cars look flat compared with the original vision. The pages are still readable, accessible (the SVG
  has `role="img"` and an `aria-label` built from `CarSpec.description`) and fast.
- axe, keyboard use and the purchase flow are all testable in jsdom, which they would not be with a
  WebGL canvas.
- If the 3D branch is never merged, nothing the kata asks for is missing. The README says the 3D studio
  was not built.
