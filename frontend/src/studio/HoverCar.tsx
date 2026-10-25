import { ContactShadows, PerspectiveCamera, View } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { Group } from 'three';
import { carDimensions } from '../lib/carGeometry';
import type { CarSpec } from '../lib/carSpec';
import { CarModel } from './CarModel';
import type { Tier } from './quality';
import { StudioLights } from './StudioLights';
import { viewPose } from './viewPose';

const FOV = 35;
const TURN_RATE = 0.9; // radians per second
const START_ANGLE = -0.5;

/** The car on a slowly turning table. Asks for a new frame every frame, so it turns only while mounted. */
function Turntable({ spec, onReady }: { spec: CarSpec; onReady: () => void }) {
  const table = useRef<Group>(null);
  const invalidate = useThree((state) => state.invalidate);
  const told = useRef(false);
  useFrame((_, delta) => {
    if (table.current) table.current.rotation.y += delta * TURN_RATE;
    if (!told.current) {
      told.current = true;
      onReady();
    }
    invalidate();
  });
  return (
    <group ref={table} rotation={[0, START_ANGLE, 0]}>
      <CarModel spec={spec} paint={spec.paint} />
    </group>
  );
}

/** One hovered card's 3D car, drawn into the shared canvas inside this element's rectangle. */
export default function HoverCar({
  spec,
  tier,
  onReady,
}: {
  spec: CarSpec;
  tier: Tier;
  onReady: () => void;
}) {
  const pose = useMemo(() => viewPose('orbit', carDimensions(spec), FOV, 400 / 176), [spec]);
  return (
    <View className="absolute inset-0">
      <PerspectiveCamera
        makeDefault
        fov={FOV}
        position={pose.position}
        onUpdate={(camera) => camera.lookAt(...pose.target)}
      />
      {/* A cheaper environment than the detail page: the card is small. */}
      <StudioLights tier={tier === 'high' ? 'medium' : tier} />
      <Turntable spec={spec} onReady={onReady} />
      <ContactShadows
        position={[0, 0.002, 0]}
        opacity={0.45}
        scale={12}
        blur={2.4}
        far={1.4}
        resolution={256}
        frames={1}
        color="#2a2118"
      />
    </View>
  );
}
