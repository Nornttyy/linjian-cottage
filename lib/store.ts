import { env } from 'cloudflare:workers';
let initialized=false;
export async function getStore() {
    const db = env.DB;
    if (!db)
        throw new Error('World storage is unavailable');
    if(!initialized){
        // The idempotent setup may run concurrently; its Promise belongs to this request.
        await db.prepare('CREATE TABLE IF NOT EXISTS worlds (id TEXT PRIMARY KEY, state TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL)').run();
        initialized=true;
    }
    return db;
}
