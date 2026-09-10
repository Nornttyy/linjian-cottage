import { env } from 'cloudflare:workers';
let ready: Promise<unknown> | undefined;
export async function getStore() {
    const db = env.DB;
    if (!db)
        throw new Error('World storage is unavailable');
    ready ??= db.prepare('CREATE TABLE IF NOT EXISTS worlds (id TEXT PRIMARY KEY, state TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL)').run().catch(error => { ready = undefined; throw error; });
    await ready;
    return db;
}
