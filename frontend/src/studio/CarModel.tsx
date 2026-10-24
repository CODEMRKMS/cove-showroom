import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { BoxGeometry, CylinderGeometry, TorusGeometry, type Group, type Material } from 'three';
import { carDimensions, taperFactor, wheelPositions } from '../lib/carGeometry';
import { doorSeams, lightPositions, windowSlabs, type Slab } from '../lib/carParts';
import type { CarSpec } from '../lib/carSpec';
import { resources } from './cache';
import {
  buildBodyGeometry,
  buildGlassGeometry,
  buildRimGeometry,
  buildTyreGeometry,
} from './geometry';
import {
  acquireMaterials,
  createFlakeTexture,
  createPaintMaterial,
  releaseMaterials,
} from './materials';
import { dampRgb, hexToRgb, rgbToHex, type Rgb } from './paint';

const PAINT_RATE = 7;

type Props = {
  spec: CarSpec;
  /** Target paint. The body eases to it. */
  paint: string;
  lightsOn?: boolean;
  /** Wheel spin in radians per second; 0 keeps the wheels still (and the render loop idle). */
  spin?: number;
};

/**
 * Shared geometry for a body style, held through the resource cache so two cars of one style share it and it
 * is freed when the last one unmounts. React 18 development double-invocation can acquire twice; the extra
 * count is released by the matching double cleanup, and disposed geometry re-uploads if drawn again.
 */
function useShared<T extends { dispose(): void }>(key: string, create: () => T): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the key fully identifies what create builds
  const value = useMemo(() => resources.acquire(key, create), [key]);
  useEffect(() => () => resources.release(key), [key]);
  return value;
}

export function CarModel({ spec, paint, lightsOn = true, spin = 0 }: Props) {
  const invalidate = useThree((state) => state.invalidate);
  const style = spec.bodyStyle;
  const dims = useMemo(() => carDimensions(spec), [spec]);
  const [rearWheel, frontWheel] = useMemo(() => wheelPositions(spec), [spec]);

  const body = useShared(`body:${style}`, () => buildBodyGeometry(spec));
  const glass = useShared(
    `glass:${style}`,
    () => buildGlassGeometry(spec) ?? new BoxGeometry(0, 0, 0),
  );
  const hasGlass = spec.roof !== 'open';
  const radius = rearWheel.radius;
  const tyreWidth = radius * 0.62;
  const tyre = useShared(`tyre:${radius.toFixed(3)}`, () => buildTyreGeometry(radius, tyreWidth));
  const rim = useShared(`rim:${radius.toFixed(3)}`, () => buildRimGeometry(radius, tyreWidth));
  const disc = useShared(
    `disc:${radius.toFixed(3)}`,
    () => new CylinderGeometry(radius * 0.52, radius * 0.52, 0.018, 32),
  );
  const well = useShared(
    `well:${radius.toFixed(3)}:${dims.width.toFixed(2)}`,
    () => new CylinderGeometry(radius + 0.045, radius + 0.045, dims.width - 0.2, 32),
  );
  const flake = useShared('flake', createFlakeTexture);

  const materials = useMemo(() => acquireMaterials(), []);
  useEffect(() => () => releaseMaterials(), []);

  // The paint material is this car's own: its colour eases toward `paint`.
  const paintMaterial = useMemo(() => createPaintMaterial(spec.paint, flake), [flake, spec.paint]);
  useEffect(() => () => paintMaterial.dispose(), [paintMaterial]);
  const colour = useRef<Rgb>(hexToRgb(spec.paint));
  const wheels = useRef<Group>(null);

  useFrame((_, delta) => {
    const target = hexToRgb(paint);
    const current = colour.current;
    if (current.some((channel, i) => Math.abs(channel - target[i]!) > 0.002)) {
      colour.current = dampRgb(current, target, PAINT_RATE, Math.min(delta, 0.1));
      paintMaterial.color.set(rgbToHex(colour.current));
      invalidate();
    } else if (rgbToHex(current) !== rgbToHex(target)) {
      colour.current = target;
      paintMaterial.color.set(rgbToHex(target));
    }
    if (spin !== 0 && wheels.current) {
      wheels.current.children.forEach((wheel) => (wheel.rotation.z -= spin * delta));
      invalidate();
    }
  });

  const half = dims.width / 2;
  const track = half - tyreWidth / 2 - 0.045;
  const { head, tail } = lightPositions(spec);
  const slabs = windowSlabs(spec);
  const seams = doorSeams(spec);
  const headMaterial = lightsOn ? materials.headOn : materials.headOff;
  const tailMaterial = lightsOn ? materials.tailOn : materials.tailOff;
  const ev = style === 'EV';

  return (
    <group>
      <mesh geometry={body} material={paintMaterial} />
      {hasGlass && <mesh geometry={glass} material={materials.glass} />}
      {slabs.windscreen && (
        <WindowSlab slab={slabs.windscreen} spec={spec} facing={1} material={materials.glass} />
      )}
      {slabs.rearWindow && (
        <WindowSlab slab={slabs.rearWindow} spec={spec} facing={-1} material={materials.glass} />
      )}

      {/* Wheels: tyre, rim, brake disc per corner, plus a dark well so the arch is never see-through. */}
      <group ref={wheels}>
        {[rearWheel, frontWheel].flatMap((wheel) =>
          [1, -1].map((side) => (
            <group key={`${wheel.axle}${side}`} position={[wheel.x, wheel.y, side * track]}>
              <mesh geometry={tyre} material={materials.tyre} />
              <group rotation={[0, side === 1 ? 0 : Math.PI, 0]}>
                <mesh geometry={rim} material={materials.rim} />
              </group>
              <mesh
                geometry={disc}
                material={materials.disc}
                rotation={[Math.PI / 2, 0, 0]}
                position={[0, 0, -side * tyreWidth * 0.15]}
              />
            </group>
          )),
        )}
      </group>
      {[rearWheel, frontWheel].map((wheel) => (
        <mesh
          key={wheel.axle}
          geometry={well}
          material={materials.trim}
          position={[wheel.x, wheel.y, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        />
      ))}

      {/* Lights, grille and badges. */}
      {ev ? (
        <>
          <mesh material={headMaterial} position={[head.x - 0.004, head.y, 0]}>
            <boxGeometry args={[0.03, 0.035, half * 1.15]} />
          </mesh>
          <mesh material={tailMaterial} position={[tail.x + 0.004, tail.y, 0]}>
            <boxGeometry args={[0.03, 0.04, half * 1.2]} />
          </mesh>
        </>
      ) : (
        [1, -1].map((side) => (
          <group key={side}>
            <mesh material={headMaterial} position={[head.x - 0.004, head.y, side * half * 0.62]}>
              <boxGeometry args={[0.05, 0.075, half * 0.36]} />
            </mesh>
            <mesh material={tailMaterial} position={[tail.x + 0.004, tail.y, side * half * 0.66]}>
              <boxGeometry args={[0.05, 0.07, half * 0.3]} />
            </mesh>
          </group>
        ))
      )}
      {spec.grille && (
        <mesh material={materials.trim} position={[dims.length / 2 - 0.004, head.y - 0.13, 0]}>
          <boxGeometry args={[0.03, 0.12, half * 0.75]} />
        </mesh>
      )}
      <Badge
        x={dims.length / 2 - 0.003}
        y={head.y - 0.02}
        material={materials.chrome}
        direction={1}
      />
      <Badge x={-dims.length / 2 + 0.003} y={tail.y} material={materials.chrome} direction={-1} />

      {/* Flank details: door seams, sill trim and mirrors. */}
      {[1, -1].map((side) => (
        <group key={side}>
          {seams.map((seam) => (
            <mesh
              key={seam.x}
              material={materials.trim}
              position={[seam.x, (seam.top + seam.bottom) / 2, side * (half + 0.002)]}
            >
              <boxGeometry args={[0.008, seam.top - seam.bottom, 0.006]} />
            </mesh>
          ))}
          <mesh
            material={materials.trim}
            position={[
              (rearWheel.x + frontWheel.x) / 2,
              dims.clearance + 0.045,
              side * (half + 0.003),
            ]}
          >
            <boxGeometry args={[dims.wheelbase - 2 * (radius + 0.12), 0.06, 0.008]} />
          </mesh>
          <Mirror spec={spec} side={side} material={paintMaterial} />
        </group>
      ))}

      {style === 'TRUCK' && <TruckBed spec={spec} material={materials.interior} />}
      {style === 'CONVERTIBLE' && <Cockpit spec={spec} material={materials.interior} />}
    </group>
  );
}

/** A glass panel lying on a slanted face of the body, pushed 8 mm outward so it never z-fights the paint. */
function WindowSlab({
  slab,
  spec,
  facing,
  material,
}: {
  slab: Slab;
  spec: CarSpec;
  facing: 1 | -1;
  material: Material;
}) {
  const { base, top } = slab;
  const dx = top[0] - base[0];
  const dy = top[1] - base[1];
  const length = Math.hypot(dx, dy);
  const normal: [number, number] =
    facing === 1 ? [dy / length, -dx / length] : [-dy / length, dx / length];
  const centre: [number, number] = [(base[0] + top[0]) / 2, (base[1] + top[1]) / 2];
  const half = (carDimensions(spec).width / 2) * taperFactor(spec, centre[0], centre[1]) * 0.84;
  return (
    <mesh
      material={material}
      position={[centre[0] + normal[0] * 0.008, centre[1] + normal[1] * 0.008, 0]}
      rotation={[0, 0, Math.atan2(dy, dx)]}
    >
      <boxGeometry args={[length * 0.9, 0.012, half * 2]} />
    </mesh>
  );
}

/** An abstract maker's mark: a ring with a bar through it. Original, not any real badge. */
function Badge({
  x,
  y,
  material,
  direction,
}: {
  x: number;
  y: number;
  material: Material;
  direction: 1 | -1;
}) {
  const ring = useShared('badge-ring', () => new TorusGeometry(0.045, 0.008, 12, 28));
  return (
    <group position={[x, y, 0]} rotation={[0, (direction * Math.PI) / 2, 0]}>
      <mesh geometry={ring} material={material} />
      <mesh material={material}>
        <boxGeometry args={[0.1, 0.012, 0.008]} />
      </mesh>
    </group>
  );
}

function Mirror({ spec, side, material }: { spec: CarSpec; side: number; material: Material }) {
  const { width } = carDimensions(spec);
  const [x, y] = [
    (spec.profile.windscreenBaseX - (spec.profile.tailX + spec.profile.noseX) / 2) * 0.0125 - 0.05,
    spec.profile.beltHeight * 0.0125 + 0.05,
  ];
  return (
    <mesh material={material} position={[x, y, side * (width / 2 + 0.035)]}>
      <boxGeometry args={[0.12, 0.07, 0.1]} />
    </mesh>
  );
}

function TruckBed({ spec, material }: { spec: CarSpec; material: Material }) {
  const { length, width } = carDimensions(spec);
  const centre = (spec.profile.tailX + spec.profile.noseX) / 2;
  const from = (spec.profile.tailX - centre) * 0.0125 + 0.1;
  const to = (spec.profile.rearGlassBaseX - centre) * 0.0125 - 0.12;
  void length;
  return (
    <mesh
      material={material}
      position={[(from + to) / 2, spec.profile.trunkHeight * 0.0125 + 0.004, 0]}
    >
      <boxGeometry args={[to - from, 0.01, width * 0.74]} />
    </mesh>
  );
}

function Cockpit({ spec, material }: { spec: CarSpec; material: Material }) {
  const { width } = carDimensions(spec);
  const centre = (spec.profile.tailX + spec.profile.noseX) / 2;
  const from = (spec.profile.windscreenBaseX - 62 - centre) * 0.0125;
  const to = (spec.profile.windscreenBaseX - 4 - centre) * 0.0125;
  const y = spec.profile.beltHeight * 0.0125;
  return (
    <group>
      <mesh material={material} position={[(from + to) / 2, y + 0.004, 0]}>
        <boxGeometry args={[to - from, 0.01, width * 0.7]} />
      </mesh>
      {[1, -1].map((side) => (
        <mesh key={side} material={material} position={[from + 0.08, y + 0.1, side * width * 0.17]}>
          <boxGeometry args={[0.1, 0.2, 0.22]} />
        </mesh>
      ))}
    </group>
  );
}
