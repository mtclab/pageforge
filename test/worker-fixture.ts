import type { Env, KVNamespace } from '../src/worker/shared.js';
import { MemoryR2, newD1 } from './d1-fixture.js';

export class MemoryKV implements KVNamespace {
  readonly values = new Map<string, string>();
  /** Per-key read/write counts, used to assert render-cache hits. */
  readonly reads = new Map<string, number>();
  readonly writes = new Map<string, number>();

  private bump(map: Map<string, number>, key: string): void {
    map.set(key, (map.get(key) ?? 0) + 1);
  }

  async get(key: string): Promise<string | null> {
    this.bump(this.reads, key);
    return this.values.get(key) ?? null;
  }

  async put(key: string, value: string): Promise<void> {
    this.bump(this.writes, key);
    this.values.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.values.delete(key);
  }

  async list(opts: { prefix?: string } = {}): Promise<{
    keys: { name: string }[];
    list_complete: boolean;
  }> {
    const prefix = opts.prefix ?? '';
    return {
      keys: [...this.values.keys()].filter((key) => key.startsWith(prefix)).sort().map((name) => ({ name })),
      list_complete: true,
    };
  }
}

export function workerEnv(overrides: Partial<Env> = {}): Env {
  return {
    SITES: new MemoryKV(),
    ASSETS: { fetch: async () => new Response('asset') },
    DB: newD1(),
    PHOTOS: new MemoryR2(),
    PUBLISH_ENABLED: 'false',
    MUTATION_API_ENABLED: 'true',
    OPERATOR_KEY: 'operator-secret',
    ...overrides,
  };
}

export function jsonRequest(
  path: string,
  method: string,
  body?: unknown,
  token?: string,
): Request {
  const headers = new Headers();
  if (body !== undefined) headers.set('content-type', 'application/json');
  if (token) headers.set('authorization', `Bearer ${token}`);
  return new Request(`https://example.test${path}`, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
