import {syncRoom} from '@/lib/room-sync';
import { getStore } from '@/lib/store';
import { applyInput, createPlayer, createWorld, publicWorld, tickWorld, normalizeWorld, type Input, type WorldState } from '@/lib/simulation';
export const dynamic = 'force-dynamic';
const allowedOrigins = new Set(['https://nornttyy.github.io']);
const corsHeaders = (req: Request): Record<string, string> => {
    const origin = req.headers.get('Origin');
    return origin && allowedOrigins.has(origin) ? { 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin' } : {};
};
const allowedRequest = (req: Request) => {
    const origin = req.headers.get('Origin');
    return !origin || origin === new URL(req.url).origin || allowedOrigins.has(origin);
};
export function OPTIONS(req: Request) {
    return new Response(null, { status: allowedRequest(req) ? 204 : 403, headers: {
        ...corsHeaders(req), 'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600',
    } });
}
async function hash(token: string) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)); return Array.from(new Uint8Array(b), n => n.toString(16).padStart(2, '0')).join(''); }
export async function POST(req: Request) {
    const serverReceivedAt=Date.now();
    const reply = (body: unknown, status = 200) => Response.json({...body as object,networkVersion:2,structureVersion:1,serverReceivedAt,serverSentAt:Date.now()}, { status, headers: { 'Cache-Control': 'no-store', ...corsHeaders(req) } });
    if (!allowedRequest(req)) return reply({ error: '来源不受支持' }, 403);
    try {
        if (Number(req.headers.get('content-length') ?? 0) > 12000)
            return reply({ error: '请求过大' }, 413);
        const payload = await req.json();
        if (!payload || typeof payload !== 'object')
            return reply({ error: '无效请求' }, 400);
        const body = payload as {
            action?: string;
            room?: unknown;
            token?: unknown;
            input?: unknown;
            protocol?:number;
            poll?:boolean;
            sinceVersion?:number;
        };
        const db = await getStore();
        const now = Date.now();
        if (body.action === 'create') {
            const id = crypto.randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase(), token = crypto.randomUUID(), playerId = crypto.randomUUID().slice(0, 8), secret = await hash(token);
            const state = createWorld(now);
            state.players[playerId] = createPlayer(playerId, secret, '旅人', 0, now);
            await db.prepare('INSERT INTO worlds (id,state,version,updated_at) VALUES (?,?,0,?)').bind(id, JSON.stringify(state), now).run();
            return reply({ room: id, token, playerId, state: publicWorld(state) });
        }
        if (typeof body.room !== 'string' || !/^[A-Z0-9]{8}$/.test(body.room))
            return reply({ error: '房间不存在' }, 404);
        const token = body.action === 'join' ? crypto.randomUUID() : body.token;
        if (typeof token !== 'string' || token.length > 100)
            return reply({ error: '请重新连接' }, 403);
        const secret = await hash(token), newId = crypto.randomUUID().slice(0, 8);
        if(body.action==='sync'&&body.protocol===2){
            const result=await syncRoom(db,body.room,secret,{input:body.input as Input|undefined,poll:body.poll,sinceVersion:body.sinceVersion,normalize:state=>normalizeWorld(state,Date.now())});
            const {status,...data}=result;return reply(data,status);
        }
        for (let attempt = 0; attempt < 6; attempt++) {
            const row = await db.prepare('SELECT state,version FROM worlds WHERE id=?').bind(body.room).first<{
                state: string;
                version: number;
            }>();
            if (!row)
                return reply({ error: '房间不存在' }, 404);
            const s = JSON.parse(row.state) as WorldState;normalizeWorld(s,now);
            let playerId = Object.keys(s.players).find(id => s.players[id].secret === secret), message: string | null = null;
            if (body.action === 'join') {
                if (Object.keys(s.players).length >= 4)
                    return reply({ error: '房间已满' }, 409);
                playerId = newId;
                s.players[playerId] = createPlayer(playerId, secret, '旅人 ' + (Object.keys(s.players).length + 1), Object.keys(s.players).length, now);
            }
            else {
                if (!playerId)
                    return reply({ error: '连接已失效' }, 403);
                tickWorld(s, now);
                const input = body.input as Input;
                if (input)
                    message = applyInput(s, playerId, input, now);
                else
                    s.players[playerId].seen = now;
            }
            const result = await db.prepare('UPDATE worlds SET state=?,version=version+1,updated_at=? WHERE id=? AND version=?').bind(JSON.stringify(s), now, body.room, row.version).run();
            if (result.meta.changes)
                return reply({ room: body.room, playerId, ...(body.action === 'join' ? { token } : {}), state: publicWorld(s), message });
        }
        return reply({ error: '世界繁忙，请重试' }, 409);
    }
    catch (error) {
        console.error('World request failed', error instanceof Error ? error.message : 'unknown');
        return reply({ error: '暂时无法连接世界' }, 503);
    }
}
