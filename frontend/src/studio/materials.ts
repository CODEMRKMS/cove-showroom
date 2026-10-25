import {
  Color,
  DataTexture,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  RGBAFormat,
  RepeatWrapping,
  UnsignedByteType,
  Vector2,
  LinearFilter,
  LinearMipmapLinearFilter,
} from 'three';
import { resources } from './cache';
import { flakeNormalData } from './flake';

/** Materials that every car shares. Created once, reference counted through the resource cache. */

const FLAKE_SIZE = 256;

/** Metallic-paint sparkle as a normal map, generated in code (no image file). Repeats every ~0.5 m of body. */
export function createFlakeTexture(): DataTexture {
  const texture = new DataTexture(
    flakeNormalData(FLAKE_SIZE, 20261025),
    FLAKE_SIZE,
    FLAKE_SIZE,
    RGBAFormat,
    UnsignedByteType,
  );
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.repeat.set(2.5, 2.5);
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

/** Clearcoated car paint in a given colour. One per car, because the colour animates per car. */
export function createPaintMaterial(colour: string, flake: DataTexture): MeshPhysicalMaterial {
  return new MeshPhysicalMaterial({
    color: new Color(colour),
    metalness: 0.55,
    roughness: 0.32,
    clearcoat: 1,
    clearcoatRoughness: 0.035,
    normalMap: flake,
    normalScale: new Vector2(0.35, 0.35),
    envMapIntensity: 1.1,
  });
}

/** Matte grey with no sheen, for the clay look. */
export function createClayMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial({ color: '#a7a39b', roughness: 0.92, metalness: 0 });
}

type Materials = {
  glass: MeshPhysicalMaterial;
  tyre: MeshStandardMaterial;
  rim: MeshStandardMaterial;
  trim: MeshStandardMaterial;
  chrome: MeshStandardMaterial;
  disc: MeshStandardMaterial;
  headOn: MeshStandardMaterial;
  headOff: MeshStandardMaterial;
  tailOn: MeshStandardMaterial;
  tailOff: MeshStandardMaterial;
  interior: MeshStandardMaterial;
};

const make: { [K in keyof Materials]: () => Materials[K] } = {
  glass: () =>
    new MeshPhysicalMaterial({
      color: '#05080b',
      metalness: 0,
      roughness: 0.06,
      clearcoat: 0.6,
      clearcoatRoughness: 0.03,
      envMapIntensity: 0.55,
    }),
  tyre: () => new MeshStandardMaterial({ color: '#15171b', roughness: 0.88, metalness: 0 }),
  rim: () => new MeshStandardMaterial({ color: '#cfd4da', roughness: 0.22, metalness: 1 }),
  trim: () => new MeshStandardMaterial({ color: '#14171b', roughness: 0.55, metalness: 0.1 }),
  chrome: () => new MeshStandardMaterial({ color: '#f1f3f6', roughness: 0.06, metalness: 1 }),
  disc: () => new MeshStandardMaterial({ color: '#6d727a', roughness: 0.5, metalness: 0.9 }),
  headOn: () =>
    new MeshStandardMaterial({
      color: '#fff8e6',
      emissive: '#ffe9b8',
      emissiveIntensity: 3,
      roughness: 0.2,
    }),
  headOff: () =>
    new MeshStandardMaterial({
      color: '#d9dde2',
      emissive: '#ffe9b8',
      emissiveIntensity: 0.05,
      roughness: 0.1,
      metalness: 0.3,
    }),
  tailOn: () =>
    new MeshStandardMaterial({
      color: '#ff3b2a',
      emissive: '#ff2314',
      emissiveIntensity: 2.6,
      roughness: 0.3,
    }),
  tailOff: () =>
    new MeshStandardMaterial({
      color: '#7a1812',
      emissive: '#ff2314',
      emissiveIntensity: 0.05,
      roughness: 0.2,
    }),
  interior: () => new MeshStandardMaterial({ color: '#1b1714', roughness: 0.8 }),
};

export const MATERIAL_NAMES = Object.keys(make) as (keyof Materials)[];

export function acquireMaterials(): Materials {
  return Object.fromEntries(
    MATERIAL_NAMES.map((name) => [name, resources.acquire(`material:${name}`, make[name])]),
  ) as Materials;
}

export function releaseMaterials(): void {
  MATERIAL_NAMES.forEach((name) => resources.release(`material:${name}`));
}

export type { Materials };
