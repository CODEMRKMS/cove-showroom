import { View } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { ACESFilmicToneMapping } from 'three';

/** Redraws when the page scrolls or resizes: the car follows its card, but nothing else would trigger a frame. */
function FollowPage() {
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    const redraw = () => invalidate();
    window.addEventListener('scroll', redraw, { passive: true });
    window.addEventListener('resize', redraw);
    return () => {
      window.removeEventListener('scroll', redraw);
      window.removeEventListener('resize', redraw);
    };
  }, [invalidate]);
  return null;
}

/**
 * The one canvas behind every card's hover turn: fixed over the whole window, ignoring the mouse, and drawing
 * each active View only inside its card's rectangle. It stays idle (frameloop "demand") until a car is hovered.
 */
export default function HoverStage() {
  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 1.25]}
      gl={{ alpha: true, antialias: true }}
      style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 20 }}
      onCreated={({ gl }) => {
        gl.toneMapping = ACESFilmicToneMapping;
        gl.setClearColor(0x000000, 0);
      }}
    >
      <View.Port />
      <FollowPage />
    </Canvas>
  );
}
