import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { DuckDBInstance, type DuckDBValue } from '@duckdb/node-api';
import { initSchemaSql } from './schema';

type QueryParams = Record<string, DuckDBValue>;
const require = createRequire(import.meta.url);

function pickUsedParams(sql: string, values?: QueryParams) {
  if (!values) {
    return undefined;
  }

  const usedNames = new Set(Array.from(sql.matchAll(/\$([A-Za-z_][A-Za-z0-9_]*)/g)).map((match) => match[1]));
  const usedValues = Object.fromEntries(Object.entries(values).filter(([key]) => usedNames.has(key)));
  return Object.keys(usedValues).length > 0 ? usedValues : undefined;
}

class DuckDbClient {
  private instancePromise?: Promise<DuckDBInstance>;
  private dbPath?: string;

  private resolveDbPath() {
    if (!this.dbPath) {
      let base = process.cwd();
      try {
        const electron = require('electron') as { app?: { getPath: (name: string) => string } };
        if (electron.app?.getPath) {
          base = electron.app.getPath('userData');
        }
      } catch {
        base = process.cwd();
      }
      this.dbPath = join(base, 'db', 'ecom_analytics.duckdb');
      mkdirSync(dirname(this.dbPath), { recursive: true });
    }
    return this.dbPath;
  }

  async getInstance() {
    if (!this.instancePromise) {
      this.instancePromise = DuckDBInstance.fromCache(this.resolveDbPath());
    }
    return this.instancePromise;
  }

  async getConnection() {
    const instance = await this.getInstance();
    return instance.connect();
  }

  async init() {
    await this.exec(initSchemaSql);
  }

  async exec(sql: string, values?: QueryParams) {
    const connection = await this.getConnection();
    try {
      await connection.run(sql, pickUsedParams(sql, values));
    } finally {
      connection.closeSync();
    }
  }

  async query<T>(sql: string, values?: QueryParams) {
    const connection = await this.getConnection();
    try {
      const reader = await connection.runAndReadAll(sql, pickUsedParams(sql, values));
      return reader.getRowObjectsJson() as T[];
    } finally {
      connection.closeSync();
    }
  }
}

export const duckDbClient = new DuckDbClient();
