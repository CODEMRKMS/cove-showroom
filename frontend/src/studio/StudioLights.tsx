import { Environment, Lightformer } from '@react-three/drei';
import type { Tier } from './quality';

/** Warm key, cool rim and soft fill, as area lights painted into the reflection environment. No HDRI file. */
export function StudioLights({ tier }: { tier: Tier }) {
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
