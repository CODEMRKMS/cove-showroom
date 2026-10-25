type Disposable = { dispose(): void };

/**
 * Reference-counted store for GPU resources (geometries, materials, textures). Two cars of the same body
 * style share one geometry; it is freed when the last car using it unmounts, not before.
 */
export function createResourceCache() {
  const entries = new Map<string, { resource: Disposable; users: number }>();
  return {
    acquire<T extends Disposable>(key: string, create: () => T): T {
      const existing = entries.get(key);
      if (existing) {
        existing.users += 1;
        return existing.resource as T;
      }
      const resource = create();
      entries.set(key, { resource, users: 1 });
      return resource;
    },
    release(key: string): void {
      const entry = entries.get(key);
      if (!entry) return;
      entry.users -= 1;
      if (entry.users <= 0) {
        entry.resource.dispose();
        entries.delete(key);
      }
    },
    size: () => entries.size,
  };
}

/** The one cache the scene uses. */
export const resources = createResourceCache();
