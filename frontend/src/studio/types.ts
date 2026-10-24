import type { RefObject } from 'react';
import type { HotspotId } from '../lib/carParts';
import type { CarSpec } from '../lib/carSpec';
import type { Tier } from './quality';

export const STUDIO_VIEWS = ['orbit', 'front', 'side', 'rear', 'top'] as const;
export type StudioView = (typeof STUDIO_VIEWS)[number];

export const VIEW_LABELS: Record<StudioView, string> = {
  orbit: 'Free orbit',
  front: 'Front',
  side: 'Side',
  rear: 'Rear',
  top: 'Top',
};

/** One spec marker on the car: a short label for its button and the note it opens. */
export type Hotspot = { id: HotspotId; label: string; text: string };

/** What the lazy-loaded WebGL scene needs. CarViewer decides all of it; the scene just draws. */
export type SceneProps = {
  spec: CarSpec;
  tier: Tier;
  /** Pixel ratio to render at, already capped for the tier. */
  dpr: number;
  view: StudioView;
  /** Signed count of 15-degree keyboard turns; the scene applies the change since its last render. */
  nudge: number;
  autoRotate: boolean;
  /** Play the clay-to-render reveal. The scene finishes it at once when this turns false. */
  intro: boolean;
  onIntroDone?: () => void;
  hotspots?: Hotspot[];
  /** DOM element the markers are drawn into, outside the role="img" stage so their buttons stay reachable. */
  overlay?: RefObject<HTMLDivElement | null>;
  onReady: () => void;
  onContextLost: () => void;
  onContextRestored: () => void;
};
