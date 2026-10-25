import { Suspense, createContext, lazy, useContext, useState, type ReactNode } from 'react';
import type { CarSpec } from '../lib/carSpec';
import type { Tier } from './quality';
import { useStudioDecision } from './useStudioDecision';

// Both pieces are their own chunk. The stage holds the one shared canvas, the car is drawn into it.
const HoverStage = lazy(() => import('./HoverStage'));
const HoverCar = lazy(() => import('./HoverCar'));

const HoverContext = createContext<{ tier: Tier } | null>(null);

/**
 * Lets the cards below turn their car in 3D on hover, drawn through ONE shared canvas (drei View), never one
 * canvas per card. Only offered where it is safe and useful: WebGL present, no reduced-motion or Save-Data
 * preference, a hover-capable pointer, and not the low tier. Elsewhere the cards stay plain pictures.
 */
export function HoverTurnProvider({ children }: { children: ReactNode }) {
  const decision = useStudioDecision();
  const [hoverable] = useState(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(hover: hover)').matches,
  );
  const tier =
    decision.status === '3d' && decision.tier !== 'low' && hoverable ? decision.tier : null;
  return (
    <HoverContext.Provider value={tier ? { tier } : null}>
      {children}
      {tier && (
        <Suspense fallback={null}>
          <HoverStage />
        </Suspense>
      )}
    </HoverContext.Provider>
  );
}

/**
 * Wraps a card's flat picture. While the mouse is over it, the 3D car turns on top of it; the picture stays
 * in the page (it is what screen readers get) and only fades once the 3D car has drawn its first frame.
 */
export function HoverTurnFrame({ spec, children }: { spec: CarSpec; children: ReactNode }) {
  const hover = useContext(HoverContext);
  const [hovered, setHovered] = useState(false);
  const [ready, setReady] = useState(false);

  const leave = () => {
    setHovered(false);
    setReady(false);
  };

  return (
    <div
      className="relative"
      onPointerEnter={(event) => {
        if (hover && event.pointerType === 'mouse') setHovered(true);
      }}
      onPointerLeave={leave}
    >
      <div style={{ opacity: ready ? 0 : 1 }} className="transition-opacity duration-200">
        {children}
      </div>
      {hover && hovered && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <Suspense fallback={null}>
            <HoverCar spec={spec} tier={hover.tier} onReady={() => setReady(true)} />
          </Suspense>
        </div>
      )}
    </div>
  );
}
