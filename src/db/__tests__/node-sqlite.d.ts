// The slice of Node's built-in SQLite the tests use (no @types/node: it would leak Node globals into app code).
declare module 'node:sqlite' {
  interface StatementSync {
    all(...params: unknown[]): unknown[];
    get(...params: unknown[]): unknown;
    setReturnArrays(enabled: boolean): void;
  }
  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
  }
}
