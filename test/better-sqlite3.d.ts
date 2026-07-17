// Minimal ambient types for better-sqlite3 (dev-only test dependency). We do
// not pull in @types/better-sqlite3 to avoid an extra dependency; this covers
// exactly the surface test/d1-fixture.ts uses. Shape mirrors @types so the
// instance type is reachable as `Database.Database`.
declare module 'better-sqlite3' {
  namespace Database {
    interface RunResult {
      changes: number;
      lastInsertRowid: number | bigint;
    }
    interface Statement {
      /** True when the statement returns rows (SELECT/PRAGMA). */
      readonly reader: boolean;
      get(...params: unknown[]): unknown;
      all(...params: unknown[]): unknown[];
      run(...params: unknown[]): RunResult;
    }
    interface Database {
      prepare(sql: string): Statement;
      exec(sql: string): Database;
      transaction<T extends (...args: never[]) => unknown>(fn: T): T;
      pragma(source: string): unknown;
      close(): void;
    }
  }
  interface DatabaseConstructor {
    new (filename?: string, options?: Record<string, unknown>): Database.Database;
    (filename?: string, options?: Record<string, unknown>): Database.Database;
  }
  const Database: DatabaseConstructor;
  export default Database;
}
