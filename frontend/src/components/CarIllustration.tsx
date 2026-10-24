import { useId } from 'react';
import type { CarSpec } from '../lib/carSpec';

const FLOOR_Y = 150;
const CLEARANCE = 17;
const GLASS = '#26323d';

type Point = readonly [x: number, h: number];

/** SVG points from (x, height-above-floor) pairs. */
const points = (list: readonly Point[]) => list.map(([x, h]) => `${x},${FLOOR_Y - h}`).join(' ');

/**
 * A side-view car on the studio floor, drawn from a CarSpec. "2.5D": flat shapes, but with a floor
 * shadow, a gloss line along the shoulder, a light-to-dark body gradient and wheels set into arches.
 * Original artwork; no manufacturer drawings or logos.
 */
export function CarIllustration({ spec, className }: { spec: CarSpec; className?: string }) {
  const uid = useId();
  const clipId = `${uid}-body`;
  const shadeId = `${uid}-shade`;
  const { profile: p, wheels } = spec;

  // The silhouette, clockwise from the rear bottom corner. A truck uses the cab outline; its bed is drawn on top.
  let outline: Point[];
  if (spec.roof === 'open') {
    outline = [
      [p.tailX, CLEARANCE],
      [p.tailX, p.trunkHeight],
      [p.windscreenBaseX - 60, p.beltHeight],
      [p.windscreenBaseX, p.beltHeight],
      [p.noseX - 36, p.hoodHeight],
      [p.noseX, p.hoodHeight - 10],
      [p.noseX, CLEARANCE],
    ];
  } else {
    outline = [
      [p.tailX, CLEARANCE],
      [p.tailX, p.trunkHeight],
      [p.rearGlassBaseX, p.trunkHeight],
      [p.rearGlassTopX, p.roofHeight],
      [p.windscreenTopX, p.roofHeight],
      [p.windscreenBaseX, p.beltHeight],
      [p.noseX - 36, p.hoodHeight],
      [p.noseX, p.hoodHeight - 10],
      [p.noseX, CLEARANCE],
    ];
  }

  const glass: Point[] =
    spec.roof === 'open'
      ? [
          [p.windscreenTopX - 2, p.roofHeight - 1],
          [p.windscreenTopX + 5, p.roofHeight - 1],
          [p.windscreenBaseX + 2, p.beltHeight + 1],
          [p.windscreenBaseX - 12, p.beltHeight + 1],
        ]
      : [
          [p.rearGlassTopX + 12, p.roofHeight - 9],
          [p.windscreenTopX - 8, p.roofHeight - 9],
          [p.windscreenBaseX - 14, p.beltHeight + 3],
          [p.rearGlassBaseX + 16, p.beltHeight + 3],
        ];
  const pillarX = (p.rearGlassTopX + p.windscreenTopX) / 2;

  const wheelCentres = [wheels.rearX, wheels.frontX];

  return (
    <svg
      role="img"
      aria-label={spec.description}
      viewBox="0 0 400 176"
      className={className}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <clipPath id={clipId}>
          <polygon points={points(outline)} />
        </clipPath>
        <linearGradient id={shadeId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.32" />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.28" />
        </linearGradient>
        <radialGradient id={`${uid}-floor`}>
          <stop offset="0" stopColor="#1c2127" stopOpacity="0.38" />
          <stop offset="1" stopColor="#1c2127" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Soft shadow on the cove floor, longer toward the left because the key light is at the right. */}
      <ellipse cx="190" cy={FLOOR_Y + 4} rx="196" ry="13" fill={`url(#${uid}-floor)`} />

      {/* Body: same-colour stroke with round joins softens the corners of the polygon. */}
      <polygon
        points={points(outline)}
        fill={spec.paint}
        stroke={spec.paint}
        strokeWidth="9"
        strokeLinejoin="round"
      />
      <g clipPath={`url(#${clipId})`}>
        <rect x="0" y="0" width="400" height={FLOOR_Y} fill={`url(#${shadeId})`} />
        {/* Gloss line along the shoulder. */}
        <line
          x1={p.tailX + 18}
          y1={FLOOR_Y - p.beltHeight + 10}
          x2={p.noseX - 40}
          y2={FLOOR_Y - p.hoodHeight + 10}
          stroke="#fff"
          strokeOpacity="0.4"
          strokeWidth="3"
          strokeLinecap="round"
        />
        {/* Lower sill, a darker band that grounds the car. */}
        <rect
          x="0"
          y={FLOOR_Y - CLEARANCE - 9}
          width="400"
          height="9"
          fill="#000"
          fillOpacity="0.22"
        />
      </g>

      {spec.bed && (
        // Open load bed behind the cab.
        <polygon
          points={points([
            [p.tailX + 8, p.trunkHeight - 2],
            [p.rearGlassBaseX - 6, p.trunkHeight - 2],
            [p.rearGlassBaseX - 6, p.trunkHeight - 14],
            [p.tailX + 8, p.trunkHeight - 14],
          ])}
          fill="#000"
          fillOpacity="0.45"
        />
      )}

      <polygon
        points={points(glass)}
        fill={GLASS}
        stroke={GLASS}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      {spec.roof !== 'open' && (
        <line
          x1={pillarX}
          y1={FLOOR_Y - p.roofHeight + 8}
          x2={pillarX + 4}
          y2={FLOOR_Y - p.beltHeight - 3}
          stroke={spec.paint}
          strokeWidth="5"
        />
      )}
      {spec.roof === 'open' && (
        // Headrest of the seat in an open-top car.
        <rect
          x={p.windscreenBaseX - 70}
          y={FLOOR_Y - p.beltHeight - 14}
          width="22"
          height="16"
          rx="6"
          fill="#2b2f36"
        />
      )}

      {/* Lights and grille. */}
      <rect
        x={p.noseX - 18}
        y={FLOOR_Y - p.hoodHeight + 2}
        width="16"
        height="8"
        rx="3"
        fill="#fff6d6"
      />
      <rect
        x={p.tailX - 2}
        y={FLOOR_Y - p.trunkHeight + 6}
        width="8"
        height="9"
        rx="2"
        fill="#c22b2b"
      />
      {spec.grille ? (
        <rect
          x={p.noseX - 12}
          y={FLOOR_Y - p.hoodHeight + 16}
          width="10"
          height="14"
          rx="2"
          fill="#15191e"
          fillOpacity="0.75"
        />
      ) : (
        <rect
          x={p.noseX - 38}
          y={FLOOR_Y - p.hoodHeight + 12}
          width="36"
          height="3"
          rx="1.5"
          fill="#fff6d6"
          fillOpacity="0.9"
        />
      )}

      {/* Wheels sit in dark arches. */}
      {wheelCentres.map((cx) => (
        <g key={cx}>
          <circle
            cx={cx}
            cy={FLOOR_Y - wheels.radius}
            r={wheels.radius + 7}
            fill="#14181d"
            fillOpacity="0.9"
          />
          <circle cx={cx} cy={FLOOR_Y - wheels.radius} r={wheels.radius} fill="#1c2127" />
          <circle cx={cx} cy={FLOOR_Y - wheels.radius} r={wheels.radius * 0.58} fill="#cdd2d8" />
          <circle cx={cx} cy={FLOOR_Y - wheels.radius} r={wheels.radius * 0.22} fill="#4b535c" />
        </g>
      ))}
    </svg>
  );
}
