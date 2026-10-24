/* eslint-disable react-hooks/immutability -- the intro drives clip planes and shared three.js materials imperatively, by design */
import { useFrame, useThree } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useRef, type Ref } from 'react';
import {
  AdditiveBlending,
  BoxGeometry,
  CylinderGeometry,
  DataTexture,
  DoubleSide,
  LinearFilter,
  MeshBasicMaterial,
  Plane,
  RGBAFormat,
  TorusGeometry,
  UnsignedByteType,
  Vector3,
  type BufferGeometry,
  type Group,
  type Material,
  type Mesh,
} from 'three';
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
import { introState, sweepX } from './intro';
import { momentState } from './moment';
import {
  acquireMaterials,
  createClayMaterial,
  createFlakeTexture,
  createPaintMaterial,
  releaseMaterials,
} from './materials';
import { dampRgb, hexToRgb, rgbToHex, type Rgb } from './paint';

const PAINT_RATE = 7;

/** The materials one rendering of the car uses. The real car and the clay twin differ only in these. */
type Look = {
  paint: Material;
  glass: Material;
  tyre: Material;
  rim: Material;
  trim: Material;
  chrome: Material;
  disc: Material;
  head: Material;
  tail: Material;
  interior: Material;
};

type Parts = {
  body: BufferGeometry;
  glass: BufferGeometry;
  tyre: BufferGeometry;
  rim: BufferGeometry;
  disc: BufferGeometry;
  well: BufferGeometry;
  badge: BufferGeometry;
};

type Props = {
  spec: CarSpec;
  /** Target paint. The body eases to it. */
  paint: string;
  lightsOn?: boolean;
  /** Wheel spin in radians per second; 0 keeps the wheels still (and the render loop idle). */
  spin?: number;
  /** Play the clay-to-render reveal. Turning this off finishes it at once. */
  intro?: boolean;
  /** Rises by one per purchase; each rise sweeps a soft light over the car. */
  moment?: number;
  onIntroDone?: () => void;
  /** Gets the head and tail light meshes once the car has mounted, so a bloom pass can single them out. */
  onLightMeshes?: (meshes: Mesh[]) => void;
};

/**
 * Shared geometry for a body style, held through the resource cache so two cars of one style share it and it
 * is freed when the last one unmounts. React development double-invocation can acquire twice; the extra
 * count is released by the matching double cleanup, and disposed geometry re-uploads if drawn again.
 */
function useShared<T extends { dispose(): void }>(key: string, create: () => T): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the key fully identifies what create builds
  const value = useMemo(() => resources.acquire(key, create), [key]);
  useEffect(() => () => resources.release(key), [key]);
  return value;
}

/** A soft vertical band of light: bright in the middle, fading to nothing at every edge. */
function createSweepTexture(): DataTexture {
  const size = 32;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const fx = 1 - Math.abs((x / (size - 1)) * 2 - 1);
      const fy = 1 - Math.abs((y / (size - 1)) * 2 - 1);
      const alpha = Math.round(255 * fx ** 2.2 * Math.min(1, fy * 2.5));
      data.set([255, 244, 224, alpha], (y * size + x) * 4);
    }
  }
  const texture = new DataTexture(data, size, size, RGBAFormat, UnsignedByteType);
  texture.magFilter = texture.minFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export function CarModel({
  spec,
  paint,
  lightsOn = true,
  spin = 0,
  intro = false,
  moment = 0,
  onIntroDone,
  onLightMeshes,
}: Props) {
  const invalidate = useThree((state) => state.invalidate);
  const style = spec.bodyStyle;
  const dims = useMemo(() => carDimensions(spec), [spec]);
  const [rearWheel] = useMemo(() => wheelPositions(spec), [spec]);
  const radius = rearWheel.radius;
  const tyreWidth = radius * 0.62;

  const parts: Parts = {
    body: useShared(`body:${style}`, () => buildBodyGeometry(spec)),
    glass: useShared(`glass:${style}`, () => buildGlassGeometry(spec) ?? new BoxGeometry(0, 0, 0)),
    tyre: useShared(`tyre:${radius.toFixed(3)}`, () => buildTyreGeometry(radius, tyreWidth)),
    rim: useShared(`rim:${radius.toFixed(3)}`, () => buildRimGeometry(radius, tyreWidth)),
    disc: useShared(
      `disc:${radius.toFixed(3)}`,
      () => new CylinderGeometry(radius * 0.52, radius * 0.52, 0.018, 32),
    ),
    well: useShared(
      `well:${radius.toFixed(3)}:${dims.width.toFixed(2)}`,
      () => new CylinderGeometry(radius + 0.045, radius + 0.045, dims.width - 0.2, 32),
    ),
    badge: useShared('badge-ring', () => new TorusGeometry(0.045, 0.008, 12, 28)),
  };
  const flake = useShared('flake', createFlakeTexture);
  const sweepTexture = useShared('sweep', createSweepTexture);

  const materials = useMemo(() => acquireMaterials(), []);
  useEffect(() => () => releaseMaterials(), []);

  // The paint material is this car's own: its colour eases toward `paint`.
  const paintMaterial = useMemo(() => createPaintMaterial(spec.paint, flake), [flake, spec.paint]);
  useEffect(() => () => paintMaterial.dispose(), [paintMaterial]);
  const colour = useRef<Rgb>(hexToRgb(spec.paint));

  const real = useMemo<Look>(
    () => ({
      paint: paintMaterial,
      glass: materials.glass,
      tyre: materials.tyre,
      rim: materials.rim,
      trim: materials.trim,
      chrome: materials.chrome,
      disc: materials.disc,
      head: lightsOn ? materials.headOn : materials.headOff,
      tail: lightsOn ? materials.tailOn : materials.tailOff,
      interior: materials.interior,
    }),
    [lightsOn, materials, paintMaterial],
  );

  // Clay twin: one matte grey for everything, plus a wireframe over the body. Only built for the intro,
  // which is decided once, when the car mounts.
  const clay = useMemo(() => {
    if (!intro) return null;
    const grey = createClayMaterial();
    const wire = new MeshBasicMaterial({
      color: '#5d5a54',
      wireframe: true,
      transparent: true,
      opacity: 0.2,
    });
    const look: Look = {
      paint: grey,
      glass: grey,
      tyre: grey,
      rim: grey,
      trim: grey,
      chrome: grey,
      disc: grey,
      head: grey,
      tail: grey,
      interior: grey,
    };
    return { grey, wire, look };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(
    () => () => {
      clay?.grey.dispose();
      clay?.wire.dispose();
    },
    [clay],
  );

  const sweepMaterial = useMemo(
    () =>
      new MeshBasicMaterial({
        map: sweepTexture,
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        side: DoubleSide,
        opacity: 0.9,
      }),
    [sweepTexture],
  );
  useEffect(() => () => sweepMaterial.dispose(), [sweepMaterial]);

  // Two clip planes slice the car at the sweep line: clay ahead of it, the real car behind it.
  const planes = useMemo(
    () => ({
      real: new Plane(new Vector3(-1, 0, 0), -dims.length / 2 - 0.3),
      clay: new Plane(new Vector3(1, 0, 0), dims.length / 2 + 0.3),
    }),
    [dims.length],
  );
  const realMaterials = useMemo(
    () => [paintMaterial, ...(Object.values(materials) as Material[])],
    [materials, paintMaterial],
  );

  const wheels = useRef<Group>(null);
  const lightMeshes = useRef(new Set<Mesh>());
  const collectLight = useCallback((mesh: Mesh | null) => {
    if (mesh) lightMeshes.current.add(mesh);
  }, []);
  useEffect(() => {
    onLightMeshes?.([...lightMeshes.current]);
    // Reported once, after the first mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const clayGroup = useRef<Group>(null);
  const sweepMesh = useRef<Mesh>(null);
  const introRef = useRef({ startedAt: null as number | null, finished: !intro });
  const flash = useRef({ moment, startedAt: null as number | null, running: false });

  // Slice the real car from the first frame, so it never flashes complete before the clay look.
  useEffect(() => {
    if (!intro) return;
    for (const material of realMaterials) {
      material.clippingPlanes = [planes.real];
      material.needsUpdate = true;
    }
    if (clay) {
      clay.grey.clippingPlanes = [planes.clay];
      clay.wire.clippingPlanes = [planes.clay];
      clay.grey.needsUpdate = clay.wire.needsUpdate = true;
    }
    return () => {
      // Materials are shared between cars: never leave a clip plane behind.
      for (const material of realMaterials) {
        material.clippingPlanes = null;
        material.needsUpdate = true;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function finishIntro() {
    const state = introRef.current;
    if (state.finished) return;
    state.finished = true;
    for (const material of realMaterials) {
      material.clippingPlanes = null;
      material.needsUpdate = true;
    }
    if (clayGroup.current) clayGroup.current.visible = false;
    if (sweepMesh.current) sweepMesh.current.visible = false;
    invalidate();
    onIntroDone?.();
  }

  // The visitor skipped: finish at once.
  useEffect(() => {
    if (!intro) finishIntro();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intro]);

  useFrame(({ clock }, delta) => {
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

    const lightning = flash.current;
    if (moment !== lightning.moment) {
      lightning.moment = moment;
      lightning.startedAt = null;
      lightning.running = true;
    }
    if (lightning.running) {
      lightning.startedAt ??= clock.elapsedTime;
      const at = momentState((clock.elapsedTime - lightning.startedAt) * 1000);
      if (sweepMesh.current) {
        sweepMesh.current.visible = at.sweep !== null;
        if (at.sweep !== null) sweepMesh.current.position.x = sweepX(at.sweep, dims.length);
      }
      if (at.done) lightning.running = false;
      invalidate();
    }

    const state = introRef.current;
    if (!state.finished) {
      state.startedAt ??= clock.elapsedTime;
      const at = introState((clock.elapsedTime - state.startedAt) * 1000);
      const x = sweepX(at.sweep, dims.length);
      planes.real.constant = x;
      planes.clay.constant = -x;
      if (sweepMesh.current) {
        sweepMesh.current.position.x = x;
        sweepMesh.current.visible = at.phase === 'sweep';
      }
      if (at.done) finishIntro();
      else invalidate();
    }
  });

  return (
    // The cache owns these geometries and materials, so React-Three-Fiber must not dispose them on unmount.
    <group dispose={null}>
      <CarParts
        spec={spec}
        parts={parts}
        look={real}
        wheelsRef={wheels}
        collectLight={collectLight}
      />
      {clay && (
        <group ref={clayGroup}>
          <CarParts spec={spec} parts={parts} look={clay.look} />
          <mesh geometry={parts.body} material={clay.wire} scale={1.002} />
        </group>
      )}
      {/* The light band. Hidden until the intro or a purchase moves it across the car. */}
      <mesh
        ref={sweepMesh}
        visible={false}
        material={sweepMaterial}
        rotation={[0, Math.PI / 2, 0]}
        position={[-dims.length / 2 - 0.3, dims.height * 0.5, 0]}
        renderOrder={5}
      >
        <planeGeometry args={[dims.width * 1.6, dims.height * 1.8]} />
      </mesh>
    </group>
  );
}

/** Every mesh of one car, drawn with the materials in `look`. */
function CarParts({
  spec,
  parts,
  look,
  wheelsRef,
  collectLight,
}: {
  spec: CarSpec;
  parts: Parts;
  look: Look;
  wheelsRef?: Ref<Group>;
  collectLight?: (mesh: Mesh | null) => void;
}) {
  const dims = useMemo(() => carDimensions(spec), [spec]);
  const [rearWheel, frontWheel] = useMemo(() => wheelPositions(spec), [spec]);
  const { radius } = rearWheel;
  const tyreWidth = radius * 0.62;
  const half = dims.width / 2;
  const track = half - tyreWidth / 2 - 0.045;
  const { head, tail } = lightPositions(spec);
  const slabs = windowSlabs(spec);
  const seams = doorSeams(spec);
  const ev = spec.bodyStyle === 'EV';

  return (
    <group>
      <mesh geometry={parts.body} material={look.paint} />
      {spec.roof !== 'open' && <mesh geometry={parts.glass} material={look.glass} />}
      {slabs.windscreen && (
        <WindowSlab slab={slabs.windscreen} spec={spec} facing={1} material={look.glass} />
      )}
      {slabs.rearWindow && (
        <WindowSlab slab={slabs.rearWindow} spec={spec} facing={-1} material={look.glass} />
      )}

      {/* Wheels: tyre, rim, brake disc per corner, plus a dark well so the arch is never see-through. */}
      <group ref={wheelsRef}>
        {[rearWheel, frontWheel].flatMap((wheel) =>
          [1, -1].map((side) => (
            <group key={`${wheel.axle}${side}`} position={[wheel.x, wheel.y, side * track]}>
              <mesh geometry={parts.tyre} material={look.tyre} />
              <group rotation={[0, side === 1 ? 0 : Math.PI, 0]}>
                <mesh geometry={parts.rim} material={look.rim} />
              </group>
              <mesh
                geometry={parts.disc}
                material={look.disc}
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
          geometry={parts.well}
          material={look.trim}
          position={[wheel.x, wheel.y, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        />
      ))}

      {/* Lights, grille and badges. */}
      {ev ? (
        <>
          <mesh ref={collectLight} material={look.head} position={[head.x - 0.004, head.y, 0]}>
            <boxGeometry args={[0.03, 0.035, half * 1.15]} />
          </mesh>
          <mesh ref={collectLight} material={look.tail} position={[tail.x + 0.004, tail.y, 0]}>
            <boxGeometry args={[0.03, 0.04, half * 1.2]} />
          </mesh>
        </>
      ) : (
        [1, -1].map((side) => (
          <group key={side}>
            <mesh
              ref={collectLight}
              material={look.head}
              position={[head.x - 0.004, head.y, side * half * 0.62]}
            >
              <boxGeometry args={[0.05, 0.075, half * 0.36]} />
            </mesh>
            <mesh
              ref={collectLight}
              material={look.tail}
              position={[tail.x + 0.004, tail.y, side * half * 0.66]}
            >
              <boxGeometry args={[0.05, 0.07, half * 0.3]} />
            </mesh>
          </group>
        ))
      )}
      {spec.grille && (
        <mesh material={look.trim} position={[dims.length / 2 - 0.004, head.y - 0.13, 0]}>
          <boxGeometry args={[0.03, 0.12, half * 0.75]} />
        </mesh>
      )}
      <Badge
        geometry={parts.badge}
        x={dims.length / 2 - 0.003}
        y={head.y - 0.02}
        material={look.chrome}
        direction={1}
      />
      <Badge
        geometry={parts.badge}
        x={-dims.length / 2 + 0.003}
        y={tail.y}
        material={look.chrome}
        direction={-1}
      />

      {/* Flank details: door seams, sill trim and mirrors. */}
      {[1, -1].map((side) => (
        <group key={side}>
          {seams.map((seam) => (
            <mesh
              key={seam.x}
              material={look.trim}
              position={[seam.x, (seam.top + seam.bottom) / 2, side * (half + 0.002)]}
            >
              <boxGeometry args={[0.008, seam.top - seam.bottom, 0.006]} />
            </mesh>
          ))}
          <mesh
            material={look.trim}
            position={[
              (rearWheel.x + frontWheel.x) / 2,
              dims.clearance + 0.045,
              side * (half + 0.003),
            ]}
          >
            <boxGeometry args={[dims.wheelbase - 2 * (radius + 0.12), 0.06, 0.008]} />
          </mesh>
          <Mirror spec={spec} side={side} material={look.paint} />
        </group>
      ))}

      {spec.bodyStyle === 'TRUCK' && <TruckBed spec={spec} material={look.interior} />}
      {spec.bodyStyle === 'CONVERTIBLE' && <Cockpit spec={spec} material={look.interior} />}
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
      <boxGeometry args={[length * 0.5, 0.012, half * 2]} />
    </mesh>
  );
}

/** An abstract maker's mark: a ring with a bar through it. Original, not any real badge. */
function Badge({
  geometry,
  x,
  y,
  material,
  direction,
}: {
  geometry: BufferGeometry;
  x: number;
  y: number;
  material: Material;
  direction: 1 | -1;
}) {
  return (
    <group position={[x, y, 0]} rotation={[0, (direction * Math.PI) / 2, 0]}>
      <mesh geometry={geometry} material={material} />
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
  const { width } = carDimensions(spec);
  const centre = (spec.profile.tailX + spec.profile.noseX) / 2;
  const from = (spec.profile.tailX - centre) * 0.0125 + 0.1;
  const to = (spec.profile.rearGlassBaseX - centre) * 0.0125 - 0.12;
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
