import { EffectComposer, N8AO, SelectiveBloom, Vignette } from '@react-three/postprocessing';
import { useMemo } from 'react';
import { Object3D } from 'three';

/**
 * Light post-processing, high tier only: a subtle ambient-occlusion pass for contact depth, a bloom that
 * only the head and tail lights feed, and a gentle vignette. Lives in its own chunk (loaded lazily), so
 * visitors on lower tiers never download the effects library.
 */
export default function PostFX({ lights }: { lights: Object3D[] }) {
  // SelectiveBloom wants scene lights to put on the selection layer. Ours are lit by the environment map,
  // so there are none; an empty object satisfies it without adding any light.
  const noSceneLights = useMemo(() => [new Object3D()], []);
  return (
    <EffectComposer multisampling={4}>
      <N8AO aoRadius={0.45} distanceFalloff={1.2} intensity={1.4} quality="performance" halfRes />
      <SelectiveBloom
        selection={lights}
        lights={noSceneLights}
        intensity={0.9}
        luminanceThreshold={0.15}
        luminanceSmoothing={0.4}
        mipmapBlur
        radius={0.3}
      />
      <Vignette offset={0.35} darkness={0.32} />
    </EffectComposer>
  );
}
