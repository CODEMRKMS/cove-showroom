/* eslint-disable react-hooks/refs -- the overlay ref goes to drei's Html as its portal target, and marker nodes are faded by direct DOM writes each frame */
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useId, useRef, useState, type RefObject } from 'react';
import { Vector3 } from 'three';
import { hotspotAnchors } from '../lib/carParts';
import type { CarSpec } from '../lib/carSpec';
import type { Hotspot } from './types';

const toCamera = new Vector3();
const anchorPoint = new Vector3();
const facing = new Vector3();

function Marker({
  hotspot,
  register,
}: {
  hotspot: Hotspot;
  register: (id: Hotspot['id'], element: HTMLDivElement | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const noteId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div
      ref={(element) => register(hotspot.id, element)}
      className="relative transition-opacity duration-200"
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? noteId : undefined}
        aria-label={hotspot.label}
        onClick={() => setOpen((value) => !value)}
        className="flex size-11 items-center justify-center rounded-full"
      >
        <span
          aria-hidden="true"
          className="flex size-6 items-center justify-center rounded-full bg-ink font-semibold text-white ring-2 ring-white"
        >
          {open ? '×' : '+'}
        </span>
      </button>
      {open && (
        <p
          id={noteId}
          role="note"
          className="absolute bottom-full left-1/2 mb-1 w-48 -translate-x-1/2 rounded-control bg-ink px-3 py-2 text-sm text-white shadow-lift"
        >
          {hotspot.text}
        </p>
      )}
    </div>
  );
}

/** The spec markers on the car, drawn into `overlay` (outside the role="img" stage). */
export function Hotspots({
  spec,
  hotspots,
  overlay,
}: {
  spec: CarSpec;
  hotspots: Hotspot[];
  overlay: RefObject<HTMLDivElement | null>;
}) {
  const anchors = hotspotAnchors(spec);
  const nodes = useRef(new Map<Hotspot['id'], HTMLDivElement>());
  const register = useRef((id: Hotspot['id'], element: HTMLDivElement | null) => {
    if (element) nodes.current.set(id, element);
    else nodes.current.delete(id);
  }).current;

  // The markers live in their own React root (drei's Html), where useFrame is unavailable, so the fade
  // runs here. A marker on the far side of the car fades out and stops taking clicks.
  useFrame(({ camera }) => {
    for (const anchor of anchors) {
      const element = nodes.current.get(anchor.id);
      if (!element) continue;
      anchorPoint.set(...anchor.position);
      toCamera.copy(camera.position).sub(anchorPoint).normalize();
      const visible = toCamera.dot(facing.set(...anchor.normal)) > 0.12;
      element.style.opacity = visible ? '1' : '0';
      element.style.pointerEvents = visible ? 'auto' : 'none';
    }
  });

  return (
    <>
      {hotspots.map((hotspot) => {
        const anchor = anchors.find((candidate) => candidate.id === hotspot.id);
        return anchor ? (
          <Html
            key={hotspot.id}
            position={anchor.position}
            center
            portal={overlay as RefObject<HTMLElement>}
            zIndexRange={[20, 0]}
            style={{ pointerEvents: 'none' }}
          >
            <Marker hotspot={hotspot} register={register} />
          </Html>
        ) : null;
      })}
    </>
  );
}
