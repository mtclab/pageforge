import type { Env, KVNamespace } from '../src/worker/shared.js';

export class MemoryKV implements KVNamespace {
  readonly values = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async put(key: string, value: string): Promise<void> {
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
