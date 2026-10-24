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
