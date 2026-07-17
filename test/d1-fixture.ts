import { readFileSync, readdirSync } from 'node:fs';
import Database from 'better-sqlite3';
import type { D1Database, D1PreparedStatement, D1Result } from '../src/worker/db.js';
import type { R2Bucket, R2Object, R2ObjectBody } from '../src/worker/shared.js';

/**
 * Adapts better-sqlite3 to the minimal D1Database shim so unit tests exercise
 * the REAL migration SQL (D1 is SQLite). batch() maps to a transaction, giving
 * the same all-or-nothing semantics the worker relies on.
 */
class SqliteStatement implements D1PreparedStatement {
  private args: unknown[] = [];

  constructor(private readonly db: Database.Database, private readonly sql: string) {}

  bind(...values: unknown[]): D1PreparedStatement {
    // D1 accepts undefined-as-null; better-sqlite3 rejects undefined outright.
    this.args = values.map((value) => (value === undefined ? null : value));
    return this;
  }

  firstSync<T>(): T | null {
    const row = this.db.prepare(this.sql).get(...this.args);
    return (row ?? null) as T | null;
  }

  runSync<T>(): D1Result<T> {
    const statement = this.db.prepare(this.sql);
    if (statement.reader) {
      return { results: statement.all(...this.args) as T[], success: true, meta: {} };
    }
    const info = statement.run(...this.args);
    return {
      results: [],
      success: true,
      meta: { last_row_id: Number(info.lastInsertRowid), changes: info.changes },
    };
  }

  first<T = Record<string, unknown>>(): Promise<T | null> {
    return Promise.resolve(this.firstSync<T>());
  }

  all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    const results = this.db.prepare(this.sql).all(...this.args) as T[];
    return Promise.resolve({ results, success: true, meta: {} });
  }

  run<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    return Promise.resolve(this.runSync<T>());
  }
}

class SqliteD1 implements D1Database {
  constructor(private readonly db: Database.Database) {}

  prepare(query: string): D1PreparedStatement {
    return new SqliteStatement(this.db, query);
  }

  batch<T = Record<string, unknown>>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    const run = this.db.transaction((stmts: SqliteStatement[]) =>
      stmts.map((statement) => statement.runSync<T>()),
    );
    return Promise.resolve(run(statements as SqliteStatement[]));
  }

  exec(query: string): Promise<{ count: number; duration: number }> {
    this.db.exec(query);
    return Promise.resolve({ count: 0, duration: 0 });
  }
}

const MIGRATIONS_DIR = new URL('../migrations/', import.meta.url);

/** Every migration file, applied in filename order (matching wrangler). */
export function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort();
}

export function migrationSql(name: string): string {
  return readFileSync(new URL(name, MIGRATIONS_DIR), 'utf8');
}

/** A fresh in-memory D1 with all migrations applied. */
export function newD1(): D1Database {
  const raw = new Database(':memory:');
  raw.pragma('foreign_keys = ON');
  for (const name of migrationFiles()) raw.exec(migrationSql(name));
  return new SqliteD1(raw);
}

/** In-memory R2 stub implementing the surface biz.ts uses. */
export class MemoryR2 implements R2Bucket {
  readonly objects = new Map<string, { bytes: Uint8Array; contentType?: string }>();

  async put(
    key: string,
    value: ArrayBuffer | Uint8Array,
    opts?: { httpMetadata?: { contentType?: string } },
  ): Promise<R2Object> {
    const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
    const contentType = opts?.httpMetadata?.contentType;
    this.objects.set(key, { bytes, ...(contentType === undefined ? {} : { contentType }) });
    return { size: bytes.byteLength, httpMetadata: { ...(contentType === undefined ? {} : { contentType }) } };
  }

  async head(key: string): Promise<R2Object | null> {
    const object = this.objects.get(key);
    if (!object) return null;
    return {
      size: object.bytes.byteLength,
      httpMetadata: { ...(object.contentType === undefined ? {} : { contentType: object.contentType }) },
    };
  }

  async get(key: string): Promise<R2ObjectBody | null> {
    const object = this.objects.get(key);
    if (!object) return null;
    const bytes = object.bytes;
    const buffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer;
    return {
      size: bytes.byteLength,
      httpMetadata: { ...(object.contentType === undefined ? {} : { contentType: object.contentType }) },
      body: new Response(buffer).body!,
      arrayBuffer: async () => buffer,
    };
  }
}
