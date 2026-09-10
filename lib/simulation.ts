import { SPAWN, WORLD_SIZE, RESOURCE_MAP, resourceAt, terrainAt, sceneAt, MINE, CAVE_ENTRANCE } from './world';
export type Tool = 'axe' | 'pick' | 'sword' | 'build';
export type Part = 'floor' | 'wall' | 'window' | 'door' | 'roof';
export type Inventory = {
    wood: number;
    stone: number;
    copper: number;
    essence: number;
};
export type Player = {
    id: string;
    name: string;
    secret?: string;
    x: number;
    y: number;
    face: 'down' | 'up' | 'left' | 'right';
    hp: number;
    stamina: number;
    inventory: Inventory;
    seen: number;
    actionAt: number;
    dodgeUntil: number;
    hitUntil: number;
    swingUntil: number;
    seq: number;
    woodGathered: number;
    kills: number;
    color: number;
    moveCredit?: number;
    attackQueue?: Command[];
    portalUntil?: number;
    equipped?: Tool;
    movingUntil?: number;
    swingStart?: number;
    hurtAt?: number;
    pendingStrike?: {command:Command;at:number};
};
export type Building = {
    id: string;
    x: number;
    y: number;
    kind: Part;
    open?: boolean;
};
export type Mob = {
    id: string;
    x: number;
    y: number;
    homeX: number;
    homeY: number;
    hp: number;
    windup: number;
    cooldown: number;
    deadUntil: number;
    hitUntil: number;
};
export type WorldState = {
    players: Record<string, Player>;
    buildings: Record<string, Building>;
    depleted: Record<string, boolean>;
    resourceHp: Record<string, number>;
    mobs: Mob[];
    tick: number;
    created: number;
    events: GameEvent[];
};
export type GameEvent = {
    id: string;
    time: number;
    x: number;
    y: number;
    kind: 'hit' | 'wood' | 'stone' | 'copper' | 'essence' | 'build' | 'hurt' | 'dodge';
    amount: number;
};
export type Command = {
    type: 'attack' | 'build' | 'remove' | 'interact' | 'dodge' | 'heal';
    x?: number;
    y?: number;
    tool?: Tool;
    part?: Part;
    target?: string;
};
export type Movement = { dx:number; dy:number; seconds:number; speed?:number };
export type Input = {
    seq: number;
    dx: number;
    dy: number;
    face?: Player['face'];
    commands: Command[];
    movements?: Movement[];
};
export const COSTS: Record<Part, Partial<Inventory>> = { floor: { wood: 2 }, wall: { wood: 3 }, window: { wood: 3, stone: 1 }, door: { wood: 4 }, roof: { wood: 2 } };
export const PART_NAMES: Record<Part, string> = { floor: '地板', wall: '木墙', window: '窗墙', door: '木门', roof: '屋顶' };
export const RESOURCE_HP = { tree: 3, pine: 3, stone: 3, copper: 4, berry: 1 };
export const layer = (part: Part) => part === 'floor' ? 'floor' : part === 'roof' ? 'roof' : 'wall';
export const buildingKey = (x: number, y: number, part: Part) => `${x}:${y}:${layer(part)}`;
export const distance = (a: {
    x: number;
    y: number;
}, b: {
    x: number;
    y: number;
}) => Math.hypot(a.x - b.x, a.y - b.y);
export function createWorld(now = Date.now()): WorldState {
    const positions = [[274, 307], [277, 341], [233, 344], [232, 297], [219, 284], [221, 288], [304, 283], [310, 270], [345, 209], [349, 204], [358, 213], [360, 222], [330, 180], [167, 406], [160, 415], [180, 422], [319, 108], [329, 100],[688,62],[664,42],[706,37],[685,20]];
    return { players: {}, buildings: {}, depleted: {}, resourceHp: {}, tick: now, created: now, events: [], mobs: positions.map(([x, y], i) => {
        const point = [[x,y],[x+1,y],[x,y+1],[x-1,y],[x,y-1]].find(([a,b]) => terrainAt(a,b)!=='water' && !resourceAt(a+.5,b+.5));
        if(!point) throw new Error('Blocked monster spawn: '+i);
        const [a,b]=point;return {id:'slime-'+i,x:a+.5,y:b+.5,homeX:a+.5,homeY:b+.5,hp:54,windup:0,cooldown:0,deadUntil:0,hitUntil:0};
    }) };
}
export function createPlayer(id: string, secret: string, name: string, color: number, now: number): Player {
    return { id, secret, name, x: SPAWN.x + color * .8, y: SPAWN.y, face: 'down', hp: 100, stamina: 100, inventory: { wood: 0, stone: 0, copper: 0, essence: 0 }, seen: now, actionAt: 0, dodgeUntil: 0, hitUntil: 0, swingUntil: 0, seq: 0, woodGathered: 0, kills: 0, color };
}
export function isBlocked(s: WorldState, x: number, y: number) {
    const t=terrainAt(Math.floor(x),Math.floor(y));
    if ((sceneAt(x)==='surface'&&(x<1||y<1||x>WORLD_SIZE-2||y>WORLD_SIZE-2)) || t==='water'||t==='cave-wall')
        return true;
    if(sceneAt(x)==='surface'&&Math.abs(x-CAVE_ENTRANCE.x)<2.6&&y<CAVE_ENTRANCE.y-1.4&&y>CAVE_ENTRANCE.y-4.7)return true;
    const r = resourceAt(x, y);
    if (r && r.kind !== 'berry' && !s.depleted[r.id])
        return true;
    const b = s.buildings[`${Math.floor(x)}:${Math.floor(y)}:wall`];
    return !!b && !(b.kind === 'door' && b.open);
}
export function clearLine(s: WorldState, a: {x:number;y:number}, b: {x:number;y:number}) {
    const steps = Math.ceil(distance(a,b) / .15);
    for (let i=1;i<steps;i++) {
        const x=a.x+(b.x-a.x)*i/steps, y=a.y+(b.y-a.y)*i/steps;
        if (isBlocked(s,x,y)) return false;
    }
    return true;
}
export function move(s: WorldState, p: {
    x: number;
    y: number;
}, dx: number, dy: number) {
    const free = (x: number, y: number) => !isBlocked(s, x - .2, y - .2) && !isBlocked(s, x + .2, y - .2) && !isBlocked(s, x - .2, y + .2) && !isBlocked(s, x + .2, y + .2);
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / .2));
    for (let i = 0; i < steps; i++) {
        if (free(p.x + dx / steps, p.y))
            p.x += dx / steps;
        if (free(p.x, p.y + dy / steps))
            p.y += dy / steps;
    }
}
function emit(s: WorldState, kind: GameEvent['kind'], x: number, y: number, amount: number, now: number) { s.events.push({ id: `${now}-${s.events.length}`, time: now, x, y, kind, amount }); }
export function tickWorld(s: WorldState, now: number) {
    const dt = Math.max(0, Math.min(.5, (now - s.tick) / 1000));
    s.tick = now;
    s.events = s.events.filter(e => now - e.time < 1400);
    const players = Object.values(s.players).filter(p => now - p.seen < 8000);
    for (const p of players) {
        p.stamina = Math.min(100, p.stamina + dt * 17);
        if(p.pendingStrike && now>=p.pendingStrike.at){const strike=p.pendingStrike;p.pendingStrike=undefined;resolveAttack(s,p,strike.command,now);}
        if (p.attackQueue?.length && now >= p.actionAt) {
            const next=p.attackQueue.shift()!;
            const scheduled=Math.max(p.actionAt,now-200);
            runCommand(s,p,next,now);
            p.actionAt=scheduled+(next.tool==='sword'?390:510);
        }
        if (distance(p, SPAWN) < 2 && now > p.hitUntil + 1500)
            p.hp = Math.min(100, p.hp + dt * 8);
    }
    for (const mob of s.mobs) {
        if (mob.hp <= 0) {
            if (now >= mob.deadUntil) {
                mob.hp = 54;
                mob.x = mob.homeX;
                mob.y = mob.homeY;
            }
            else
                continue;
        }
        let target: Player | undefined, closest = 8;
        for (const p of players) {
            const d = distance(p, mob);
            if (d < closest && distance(p, SPAWN) > 7) {
                target = p;
                closest = d;
            }
        }
        if (mob.windup) {
            if (now >= mob.windup) {
                if (target && closest < 1.65 && now > target.dodgeUntil && now > target.hitUntil && clearLine(s,mob,target)) {
                    target.hp -= 14;
                    target.hurtAt=now;
                    target.hitUntil = now + 650;
                    emit(s, 'hurt', target.x, target.y, 14, now);
                    const n = closest || 1;
                    move(s, target, (target.x - mob.x) / n * .5, (target.y - mob.y) / n * .5);
                }
                mob.windup = 0;
                mob.cooldown = now + 1100;
            }
            continue;
        }
        if (target) {
            if (closest < 1.2 && now >= mob.cooldown)
                mob.windup = now + 650;
            else if (closest > 1.05) {
                const speed = now < mob.hitUntil ? .5 : 1.7;
                move(s, mob, (target.x - mob.x) / closest * speed * dt, (target.y - mob.y) / closest * speed * dt);
            }
        }
        else if (players.some(p => distance(p, mob) < 16)) {
            const x = mob.homeX + Math.sin(now / 5000 + mob.homeX) * 1.5, y = mob.homeY + Math.cos(now / 6200 + mob.homeY) * 1.5;
            const d = Math.hypot(x - mob.x, y - mob.y);
            if (d > .1)
                move(s, mob, (x - mob.x) / d * .45 * dt, (y - mob.y) / d * .45 * dt);
        }
    }
    for (const p of players)
        if (p.hp <= 0) {
            p.x = SPAWN.x;
            p.y = SPAWN.y;
            p.hp = 75;
            p.hitUntil = now + 3000;
        }
}
export function canBuild(s: WorldState, p: Player, x: number, y: number, part: Part): string | null {
    if(sceneAt(p.x)==='mine')return '矿洞内无法建造';
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 1 || y < 1 || x >= 511 || y >= 511)
        return '无法放置';
    if (distance(p, { x: x + .5, y: y + .5 }) > 5)
        return '距离太远';
    if (terrainAt(x, y) === 'water')
        return '需要陆地';
    if (Math.hypot(x + .5 - SPAWN.x, y + .5 - SPAWN.y) < 1.6)
        return '营火区域';
    if(Math.hypot(x+.5-CAVE_ENTRANCE.x,y+.5-CAVE_ENTRANCE.y)<5)return '保留洞口通道';
    const r = resourceAt(x, y);
    if (r && !s.depleted[r.id])
        return '先清理资源';
    if (s.buildings[buildingKey(x, y, part)])
        return '已被占用';
    if (part !== 'floor' && !s.buildings[`${x}:${y}:floor`])
        return '需要地板';
    if (layer(part) === 'wall' && Object.values(s.players).some(q => distance(q, { x: x + .5, y: y + .5 }) < .8))
        return '有人站在这里';
    for (const [key, count] of Object.entries(COSTS[part]))
        if (p.inventory[key as keyof Inventory] < (count || 0))
            return '材料不足';
    return null;
}
function runCommand(s: WorldState, p: Player, c: Command, now: number): string | null {
    if (c.type === 'heal') {
        if (p.inventory.essence > 0 && p.hp < 100) { p.inventory.essence--; p.hp = Math.min(100,p.hp+30); }
        return null;
    }
    if (c.type === 'dodge') {
        if (now < p.dodgeUntil + 450 || p.stamina < 28)
            return null;
        p.stamina -= 28;
        p.dodgeUntil = now + 330;
        emit(s, 'dodge', p.x, p.y, 0, now);
        return null;
    }
    if (c.type === 'interact') {
        if(transitionScene(p,now,2))return null;
        const door = Object.values(s.buildings).filter(b => b.kind === 'door' && distance(p, { x: b.x + .5, y: b.y + .5 }) < 2).sort((a, b) => distance(p, a) - distance(p, b))[0];
        if (door) {
            if (door.open && Object.values(s.players).some(q => Math.floor(q.x) === door.x && Math.floor(q.y) === door.y))
                return '门口有人';
            door.open = !door.open;
        }
        return null;
    }
    if (c.type === 'build') {
        const part = c.part;
        if (!part || !['floor', 'wall', 'window', 'door', 'roof'].includes(part))
            return '无效构件';
        const x = Math.floor(c.x ?? -1), y = Math.floor(c.y ?? -1), error = canBuild(s, p, x, y, part);
        if (error)
            return error;
        for (const [key, count] of Object.entries(COSTS[part]))
            p.inventory[key as keyof Inventory] -= count || 0;
        const id = buildingKey(x, y, part);
        s.buildings[id] = { id, x, y, kind: part, open: part === 'door' };
        emit(s, 'build', x + .5, y + .5, 0, now);
        return null;
    }
    if (c.type === 'remove') {
        const x = Math.floor(c.x ?? -1), y = Math.floor(c.y ?? -1);
        if (distance(p, { x: x + .5, y: y + .5 }) > 5)
            return '距离太远';
        const b = s.buildings[`${x}:${y}:roof`] || s.buildings[`${x}:${y}:wall`] || s.buildings[`${x}:${y}:floor`];
        if (!b)
            return null;
        for (const [key, count] of Object.entries(COSTS[b.kind]))
            p.inventory[key as keyof Inventory] += count || 0;
        delete s.buildings[b.id];
        emit(s, 'build', x + .5, y + .5, 0, now);
        return null;
    }
    if (c.type === 'attack') {
        if (now < p.actionAt) {
            p.attackQueue ??= [];
            if(p.attackQueue.length<3)p.attackQueue.push({...c});
            return null;
        }
        p.actionAt = now + (c.tool === 'sword' ? 390 : 510);
        p.swingStart=now;
        p.swingUntil = now + (c.tool==='sword'?370:490);
        p.equipped=c.tool;
        if(c.tool!=='sword'){
            const r=c.target?RESOURCE_MAP.get(c.target):undefined;
            if(r&&!s.depleted[r.id]){
                if(distance(p,{x:r.x+.5,y:r.y+.5})>2.5)return '距离太远';
                const required=r.kind==='tree'||r.kind==='pine'||r.kind==='berry'?'axe':'pick';
                if(c.tool!==required)return required==='axe'?'使用斧头':'使用镐';
            }
        }
        p.pendingStrike={command:{...c},at:now+(c.tool==='sword'?170:245)};
        return null;
    }
    return null;
}
function resolveAttack(s:WorldState,p:Player,c:Command,now:number):string|null{
        if (c.tool === 'sword') {
            const target = s.mobs.find(m => m.id === c.target && m.hp > 0 && distance(p, m) < 2.3) || s.mobs.filter(m => m.hp > 0 && distance(p, m) < 1.9).sort((a, b) => distance(p, a) - distance(p, b))[0];
            if (target && clearLine(s,p,target)) {
                target.hp -= 18;
                target.hitUntil = now + 350;
                target.windup = 0;
                const d = distance(p, target) || 1;
                move(s, target, (target.x - p.x) / d * .5, (target.y - p.y) / d * .5);
                emit(s, 'hit', target.x, target.y, 18, now);
                if (target.hp <= 0) {
                    target.deadUntil = now + 90000;
                    p.inventory.essence += 2;
                    p.kills++;
                    emit(s, 'essence', target.x, target.y, 2, now);
                }
            }
            return null;
        }
        const r = c.target ? RESOURCE_MAP.get(c.target) : undefined;
        if (!r || s.depleted[r.id])
            return null;
        if (distance(p, { x: r.x + .5, y: r.y + .5 }) > 2.5)
            return '距离太远';
        const tool = r.kind === 'tree' || r.kind === 'pine' || r.kind === 'berry' ? 'axe' : 'pick';
        if (c.tool !== tool)
            return tool === 'axe' ? '使用斧头' : '使用镐';
        const hp = (s.resourceHp[r.id] ?? RESOURCE_HP[r.kind]) - 1;
        s.resourceHp[r.id] = hp;
        emit(s, 'hit', r.x + .5, r.y + .5, 1, now);
        if (hp <= 0) {
            s.depleted[r.id] = true;
            delete s.resourceHp[r.id];
            const item = r.kind === 'tree' || r.kind === 'pine' ? 'wood' : r.kind === 'copper' ? 'copper' : r.kind === 'berry' ? 'essence' : 'stone';
            const count = item === 'wood' ? 6 : item === 'stone' ? 5 : item === 'copper' ? 3 : 1;
            p.inventory[item] += count;
            if (item === 'wood')
                p.woodGathered += count;
            emit(s, item, r.x + .5, r.y + .5, count, now);
        }
        return null;
}
export function applyInput(s: WorldState, id: string, input: Input, now: number): string | null {
    const p = s.players[id];
    if (!p)
        return '角色不存在';
    if (!Number.isSafeInteger(input.seq) || input.seq <= p.seq)
        return null;
    const dt = Math.max(0, Math.min(1, (now - p.seen) / 1000));
    p.seen = now;
    p.seq = input.seq;
    let message: string | null = null;
    for (const command of (Array.isArray(input.commands) ? input.commands : []).slice(0, 5)) {
        const result = runCommand(s, p, command, now);
        if (result)
            message = result;
    }
    let credit=Math.min(.75,(p.moveCredit??.05)+dt);
    const movements=Array.isArray(input.movements)?input.movements.slice(0,64):[{dx:input.dx,dy:input.dy,seconds:Math.min(.35,dt)}];
    for(const segment of movements){
        const dx=Number.isFinite(segment.dx)?Math.max(-1,Math.min(1,segment.dx)):0;
        const dy=Number.isFinite(segment.dy)?Math.max(-1,Math.min(1,segment.dy)):0;
        const seconds=Number.isFinite(segment.seconds)?Math.max(0,Math.min(credit,segment.seconds)):0;
        const length=Math.max(1,Math.hypot(dx,dy)),speed=now<p.dodgeUntil?9:4.2;
        move(s,p,dx/length*speed*seconds,dy/length*speed*seconds);credit-=seconds;
        if(seconds>0&&(dx||dy))p.movingUntil=now+220;
    }
    p.moveCredit=credit;
    transitionScene(p,now,.78);
    if (input.face && ['up', 'down', 'left', 'right'].includes(input.face))
        p.face = input.face;
    return message;
}
export function transitionScene(p:Player,now:number,radius:number){
    if(now<(p.portalUntil??0))return false;
    const underground=sceneAt(p.x)==='mine',portal=underground?MINE.exit:CAVE_ENTRANCE;
    if(distance(p,portal)>radius)return false;
    const destination=underground?{x:CAVE_ENTRANCE.x,y:CAVE_ENTRANCE.y+2}:MINE.spawn;
    p.x=destination.x;p.y=destination.y;p.portalUntil=now+1800;p.face='down';p.attackQueue=[];p.pendingStrike=undefined;p.moveCredit=0;
    return true;
}
export function publicWorld(s: WorldState): WorldState { return { ...s, players: Object.fromEntries(Object.entries(s.players).map(([id, p]) => { const clean = { ...p }; delete clean.secret; return [id, clean]; })) }; }
