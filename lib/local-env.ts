import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
mkdirSync(resolve('.local'), { recursive: true });
const database = new DatabaseSync(resolve('.local/worlds.sqlite'));
database.exec('PRAGMA journal_mode=WAL');
class Statement {
    args: (string | number | null)[] = [];
    constructor(private sql: string) { }
    bind(...args: (string | number | null)[]) { this.args = args; return this; }
    async first<T>() { return (database.prepare(this.sql).get(...this.args) ?? null) as T | null; }
    async run() { const r = database.prepare(this.sql).run(...this.args); return { success: true, meta: { changes: Number(r.changes) } }; }
}
export const env = { DB: { prepare: (sql: string) => new Statement(sql) } };
