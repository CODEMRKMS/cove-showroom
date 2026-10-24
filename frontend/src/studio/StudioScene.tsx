/* eslint-disable react-hooks/refs, react-hooks/immutability -- the camera rig drives mutable three.js objects (camera, controls) by design */
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { ACESFilmicToneMapping, Vector3, type Mesh } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { carDimensions, type CarDimensions } from '../lib/carGeometry';
import { CarModel } from './CarModel';
import { Hotspots } from './Hotspots';
import type { Tier } from './quality';
import type { SceneProps, StudioView } from './types';
import { momentState, pullScale } from './moment';
import { viewPose } from './viewPose';

// Effects (ambient occlusion, bloom, vignette) are their own chunk, fetched only on the high tier.
const PostFX = lazy(() => import('./PostFX'));

const FOV = 35;
const NUDGE_RADIANS = (15 * Math.PI) / 180;
const GLIDE_RATE = 5;

/**
 * Moves the camera when the visitor picks a view or turns the car with the keyboard. It glides to the new
 * pose, and gives up the moment the visitor grabs the car themselves.
 */
function Rig({
  dims,
  view,
  nudge,
  moment,
  onUserMove,
}: {
  dims: CarDimensions;
  view: StudioView;
  nudge: number;
  moment: number;
  onUserMove: () => void;
}) {
  const { camera, invalidate, size } = useThree();
  const controls = useThree((state) => state.controls) as OrbitControlsImpl | null;
  const aspect = useRef(size.width / size.height);
  aspect.current = size.width / size.height;
  const goal = useRef<{ position: Vector3; target: Vector3 } | null>(null);
  const placed = useRef<string | null>(null);
  const lastNudge = useRef(nudge);
  const lastMoment = useRef(moment);
  const pulse = useRef<{ startedAt: number | null; offset: Vector3 } | null>(null);

  useEffect(() => {
    const key = `${view}:${dims.length}`;
    if (placed.current === key) return;
    const pose = viewPose(view, dims, FOV, aspect.current);
    const next = { position: new Vector3(...pose.position), target: new Vector3(...pose.target) };
    if (placed.current === null) {
      // First placement: no glide, the car should already be framed when it appears.
      camera.position.copy(next.position);
      controls?.target.copy(next.target);
      controls?.update();
    } else {
      goal.current = next;
    }
    placed.current = key;
    invalidate();
  }, [camera, controls, dims, invalidate, view]);

  useEffect(() => {
    const steps = nudge - lastNudge.current;
    lastNudge.current = nudge;
    if (steps === 0 || !controls) return;
    const target = goal.current?.target ?? controls.target;
    const from = goal.current?.position ?? camera.position;
    const offset = from
      .clone()
      .sub(target)
      .applyAxisAngle(new Vector3(0, 1, 0), -steps * NUDGE_RADIANS);
    goal.current = { position: target.clone().add(offset), target: target.clone() };
    onUserMove();
    invalidate();
  }, [camera, controls, invalidate, nudge, onUserMove]);

  // A purchase: ease the camera back along its own line of sight and return it. Orbiting is paused meanwhile.
  useEffect(() => {
    if (moment === lastMoment.current || !controls) return;
    lastMoment.current = moment;
    goal.current = null;
    pulse.current = { startedAt: null, offset: camera.position.clone().sub(controls.target) };
    controls.enabled = false;
    invalidate();
  }, [camera, controls, invalidate, moment]);

  useEffect(() => {
    if (!controls) return;
    const cancel = () => (goal.current = null);
    controls.addEventListener('start', cancel);
    // Let a vertical swipe scroll the page; horizontal drags still turn the car.
    if (controls.domElement) controls.domElement.style.touchAction = 'pan-y';
    return () => controls.removeEventListener('start', cancel);
  }, [controls]);

  useFrame(({ clock }, delta) => {
    const active = pulse.current;
    if (active && controls) {
      active.startedAt ??= clock.elapsedTime;
      const at = momentState((clock.elapsedTime - active.startedAt) * 1000);
      camera.position.copy(controls.target).addScaledVector(active.offset, pullScale(at.pull));
      controls.update();
      if (at.done) {
        pulse.current = null;
        controls.enabled = true;
      }
      invalidate();
      return;
    }
    const g = goal.current;
    if (!g || !controls) return;
    const mix = 1 - Math.exp(-GLIDE_RATE * Math.min(delta, 0.1));
    camera.position.lerp(g.position, mix);
    controls.target.lerp(g.target, mix);
    controls.update();
    if (camera.position.distanceTo(g.position) < 0.002) goal.current = null;
    invalidate();
  });
  return null;
}

/** Warm key, cool rim and soft fill, as area lights painted into the reflection environment. No HDRI file. */
function StudioLights({ tier }: { tier: Tier }) {
  return (
    <Environment resolution={tier === 'high' ? 256 : 128} frames={1}>
      {/* Key: large warm softbox, front-right and high. */}
      <Lightformer
        form="rect"
        intensity={7}
        color="#ffe3c2"
        position={[5, 4, 3.5]}
        scale={[7, 3.2, 1]}
      />
      {/* Rim: cool strip behind the car on the left. */}
      <Lightformer
        form="rect"
        intensity={5}
        color="#bcd3ff"
        position={[-5.5, 3, -4.5]}
        scale={[9, 1.6, 1]}
      />
      {/* Fill: dim overhead sheet. */}
      <Lightformer
        form="rect"
        intensity={1.4}
        color="#fff4e4"
        position={[0, 6, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        scale={[11, 11, 1]}
      />
      {/* Cove floor bounce: pale warm light from below, so the sills pick up the floor. */}
      <Lightformer
        form="rect"
        intensity={0.9}
        color="#eadfce"
        position={[0, -2.5, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[14, 14, 1]}
      />
    </Environment>
  );
}

function Ready({ onReady }: { onReady: () => void }) {
  const done = useRef(false);
  useFrame(() => {
    if (done.current) return;
    done.current = true;
    onReady();
  });
  return null;
}

/** True while the element is on screen and the tab is visible; the scene stops drawing otherwise. */
function useWatching(element: React.RefObject<HTMLElement | null>): boolean {
  const [onScreen, setOnScreen] = useState(true);
  const [tabVisible, setTabVisible] = useState(
    () => typeof document === 'undefined' || document.visibilityState !== 'hidden',
  );
  useEffect(() => {
    const node = element.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) =>
      setOnScreen(entry?.isIntersecting ?? true),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [element]);
  useEffect(() => {
    const update = () => setTabVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  return onScreen && tabVisible;
}

/** The WebGL scene: one car on the studio floor, orbit controls, area-light reflections, soft contact shadow. */
export default function StudioScene({
  spec,
  tier,
  dpr,
  view,
  nudge,
  autoRotate,
  intro,
  moment,
  onIntroDone,
  hotspots,
  overlay,
  onReady,
  onContextLost,
  onContextRestored,
}: SceneProps) {
  const wrapper = useRef<HTMLDivElement>(null);
  const watching = useWatching(wrapper);
  const [turning, setTurning] = useState(autoRotate);
  const [epoch, setEpoch] = useState(0);
  const [lights, setLights] = useState<Mesh[]>([]);
  const dims = useMemo(() => carDimensions(spec), [spec]);

  // Callbacks live in refs so the long-lived canvas listeners always call the latest ones.
  const callbacks = useRef({ onContextLost, onContextRestored });
  useEffect(() => {
    callbacks.current = { onContextLost, onContextRestored };
  });

  const stopTurning = useRef(() => setTurning(false)).current;
  const high = tier === 'high';
  const distance = viewPose('orbit', dims, FOV, 16 / 9);
  const reach = Math.hypot(...distance.position);

  return (
    <div ref={wrapper} className="size-full">
      <Canvas
        key={epoch}
        frameloop={watching ? 'demand' : 'never'}
        dpr={dpr}
        camera={{ fov: FOV, near: 0.1, far: 80 }}
        gl={{
          antialias: tier !== 'low',
          alpha: true,
          powerPreference: high ? 'high-performance' : 'default',
        }}
        onCreated={({ gl, invalidate }) => {
          gl.localClippingEnabled = true;
          gl.toneMapping = ACESFilmicToneMapping;
          gl.toneMappingExposure = 1;
          gl.setClearColor(0x000000, 0);
          const canvas = gl.domElement;
          canvas.addEventListener('webglcontextlost', (event) => {
            // Without preventDefault the browser never offers to restore the context.
            event.preventDefault();
            callbacks.current.onContextLost();
          });
          canvas.addEventListener('webglcontextrestored', () => {
            setEpoch((n) => n + 1);
            callbacks.current.onContextRestored();
            invalidate();
          });
        }}
      >
        <StudioLights tier={tier} />
        <CarModel
          spec={spec}
          paint={spec.paint}
          intro={intro}
          moment={moment}
          onIntroDone={onIntroDone}
          onLightMeshes={setLights}
        />
        <ContactShadows
          position={[0, 0.002, 0]}
          opacity={0.5}
          scale={14}
          blur={2.6}
          far={1.5}
          resolution={tier === 'low' ? 256 : 512}
          frames={1}
          color="#2a2118"
        />
        <OrbitControls
          makeDefault
          enablePan={false}
          enableDamping
          dampingFactor={0.08}
          minPolarAngle={0.25}
          maxPolarAngle={Math.PI / 2 - 0.03}
          minDistance={reach * 0.5}
          maxDistance={reach * 1.8}
          autoRotate={turning && !intro}
          autoRotateSpeed={0.9}
          onStart={stopTurning}
        />
        {hotspots && overlay && <Hotspots spec={spec} hotspots={hotspots} overlay={overlay} />}
        <Rig dims={dims} view={view} nudge={nudge} moment={moment} onUserMove={stopTurning} />
        {high && lights.length > 0 && (
          <Suspense fallback={null}>
            <PostFX lights={lights} />
          </Suspense>
        )}
        <Ready onReady={onReady} />
      </Canvas>
    </div>
  );
}
