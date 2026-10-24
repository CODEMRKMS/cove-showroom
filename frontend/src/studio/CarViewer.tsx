import {
  Component,
  Suspense,
  lazy,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { CarIllustration } from '../components/CarIllustration';
import type { CarSpec } from '../lib/carSpec';
import { STUDIO_VIEWS, VIEW_LABELS, type Hotspot, type StudioView } from './types';
import { useStudioDecision } from './useStudioDecision';

// The scene (three.js and friends) is its own chunk: nothing else may import it statically.
const StudioScene = lazy(() => import('./StudioScene'));

/** Catches anything the scene throws (shader compile, GPU out of memory) so the page keeps its SVG car. */
class SceneBoundary extends Component<
  { onError: () => void; children: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch() {
    this.props.onError();
  }
  override render() {
    return this.state.failed ? null : this.props.children;
  }
}

type Props = {
  spec: CarSpec;
  className?: string;
  /** Show the View select and let the arrow keys turn the car. */
  interactive?: boolean;
  autoRotate?: boolean;
  /** Spec markers drawn on the car in 3D. The SVG fallback shows none; the page lists the same facts. */
  hotspots?: Hotspot[];
  /** Play the clay-to-render reveal, once per browser session. */
  intro?: boolean;
  /** A counter the page raises after each purchase. Each rise plays the purchase moment in 3D. */
  moment?: number;
  /** CSS aspect-ratio of the stage, as "width / height". The SVG poster is centred inside it. */
  aspect?: string;
};

/**
 * A car in the studio. Always starts as the SVG illustration (real DOM, no layout shift) and swaps to the
 * WebGL scene only if the device allows it: WebGL present, no reduced-motion or Save-Data preference, and
 * not a low-tier phone. If the scene fails or the GPU context is lost, the SVG comes back.
 */
export function CarViewer({
  spec,
  className = '',
  interactive = false,
  autoRotate = true,
  hotspots,
  intro = false,
  moment = 0,
  aspect = '400 / 176',
}: Props) {
  const decision = useStudioDecision(intro);
  const [ready, setReady] = useState(false);
  const [lost, setLost] = useState(false);
  const [failed, setFailed] = useState(false);
  const [view, setView] = useState<StudioView>('orbit');
  const [nudge, setNudge] = useState(0);
  const [introOver, setIntroOver] = useState(false);
  const viewId = useId();
  const overlay = useRef<HTMLDivElement>(null);

  const scene = decision.status === '3d' && !failed;
  const showing3d = scene && ready && !lost;
  const introActive = decision.status === '3d' && decision.intro && !introOver;

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'ArrowRight') setNudge((n) => n + 1);
    else if (event.key === 'ArrowLeft') setNudge((n) => n - 1);
    else return;
    event.preventDefault();
  }

  return (
    <div className={`relative ${className}`}>
      <div className="relative w-full" style={{ aspectRatio: aspect }}>
        {!showing3d && (
          <div className="absolute inset-0 flex items-center justify-center">
            <CarIllustration spec={spec} className="h-auto max-h-full w-full" />
          </div>
        )}
        {decision.status === '3d' && !failed && (
          <div
            role="group"
            aria-label="3D viewer. Arrow keys turn the car."
            data-tier={decision.tier}
            aria-hidden={showing3d ? undefined : true}
            tabIndex={showing3d && interactive ? 0 : -1}
            onKeyDown={interactive ? onKeyDown : undefined}
            className={`absolute inset-0 ${showing3d ? '' : 'pointer-events-none invisible'}`}
          >
            <div
              role="img"
              aria-label={`${spec.description}, interactive 3D view`}
              className="size-full"
            >
              <SceneBoundary onError={() => setFailed(true)}>
                <Suspense fallback={null}>
                  <StudioScene
                    spec={spec}
                    tier={decision.tier}
                    dpr={decision.dpr}
                    view={view}
                    nudge={nudge}
                    autoRotate={autoRotate}
                    intro={introActive}
                    moment={moment}
                    onIntroDone={() => setIntroOver(true)}
                    hotspots={hotspots}
                    overlay={overlay}
                    onReady={() => setReady(true)}
                    onContextLost={() => setLost(true)}
                    onContextRestored={() => setLost(false)}
                  />
                </Suspense>
              </SceneBoundary>
            </div>
            <div ref={overlay} className="pointer-events-none absolute inset-0 overflow-hidden" />
          </div>
        )}
      </div>
      {introActive && showing3d && (
        <button
          type="button"
          onClick={() => setIntroOver(true)}
          className="absolute right-2 bottom-2 inline-flex min-h-11 items-center rounded-control bg-ink/85 px-4 font-semibold text-white"
        >
          Skip intro
        </button>
      )}
      {interactive && showing3d && (
        <div className="mt-2 flex items-center gap-2">
          <label htmlFor={viewId} className="font-semibold">
            View
          </label>
          <select
            id={viewId}
            value={view}
            onChange={(event) => setView(event.target.value as StudioView)}
            className="min-h-11 rounded-control border border-graphite bg-white/70 px-3"
          >
            {STUDIO_VIEWS.map((option) => (
              <option key={option} value={option}>
                {VIEW_LABELS[option]}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
