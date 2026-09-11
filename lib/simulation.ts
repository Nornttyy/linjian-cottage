import { SPAWN, WORLD_SIZE, RESOURCE_MAP, resourceAt, terrainAt, sceneAt, MINE, CAVE_ENTRANCE } from './world';
import {CROPS,FARM_WATER_MS,cropProgress,growPlot,plotKey,type CropKind,type Plot} from './farming';
import {CREATURES,CREATURE_SPAWNS,type CreatureKind} from './creatures';
import {atLevel,buildingKey,floorLevel,canReachGround,wallRects,wallOccupies,layer,MAX_LEVEL,COSTS,PART_NAMES,type Part,type Building} from './structures';
export {buildingKey,layer,COSTS,PART_NAMES};
export type {Part,Building};
export type Tool = 'axe' | 'pick' | 'sword' | 'build' | 'hoe' | 'water' | 'seed';
export type CombatTool='axe'|'pick'|'sword';
export const WORK_TIMING={hammer:{duration:300,contact:110},hoe:{duration:380,contact:160},water:{duration:500,contact:180},plant:{duration:360,contact:140}} as const;
export type WorkAction=keyof typeof WORK_TIMING;
// Match the bounded client request timeout: delayed input still represents elapsed movement.
const INPUT_HISTORY_SECONDS=8;
export const TOOL_TIMING = {
    axe: { duration: 360, contact: 180, cooldown: 380 },
    pick: { duration: 360, contact: 180, cooldown: 380 },
    sword: { duration: 280, contact: 120, cooldown: 300 },
} as const;
export type Inventory = {
    wood: number;
    stone: number;
    copper: number;
    essence: number;
    carrotSeed:number;tomatoSeed:number;wheatSeed:number;carrot:number;tomato:number;wheat:number;
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
    dodgeMoveCredit?: number;
    dodgeMoveUntil?: number;
    hitUntil: number;
    swingUntil: number;
    seq: number;
    woodGathered: number;
    kills: number;
    color: number;
    level?:number;
    workAction?:WorkAction;workStart?:number;workUntil?:number;
    lastCommandId?:string;
    moveCredit?: number;
    attackQueue?: Command[];
    portalUntil?: number;
    equipped?: Tool;
    movingUntil?: number;
    swingStart?: number;
    swingFace?: Player['face'];
    hurtAt?: number;
    pendingStrike?: {command:Command;at:number};
};
export type Mob = {
    kind?:CreatureKind;level?:number;face?:Player['face'];attackX?:number;attackY?:number;attackAt?:number;chargeUntil?:number;chargeX?:number;chargeY?:number;chargeHits?:string[];
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
    movingUntil?: number;
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
    plots?:Record<string,Plot>;
    creatureVersion?:number;
};
export type GameEvent = {
    id: string;
    time: number;
    x: number;
    y: number;
    kind: 'hit' | 'wood' | 'stone' | 'copper' | 'essence' | 'build' | 'hurt' | 'dodge' | 'door' | 'till' | 'plant' | 'water' | 'harvest' | 'spore';
    level?:number;actorId?:string;commandId?:string;targetId?:string;crop?:CropKind;
    amount: number;
};
export type Command = {
    type: 'attack' | 'build' | 'remove' | 'interact' | 'dodge' | 'heal' | 'ascend' | 'descend' | 'till' | 'plant' | 'water' | 'harvest' | 'eat';
    id?:string;issuedAt?:number;crop?:CropKind;
    x?: number;
    y?: number;
    tool?: Tool;
    part?: Part;
    target?: string;
    face?: Player['face'];
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
export const RESOURCE_HP = { tree: 3, pine: 3, stone: 3, copper: 4, berry: 1 };
export const distance = (a: {
    x: number;
    y: number;
}, b: {
    x: number;
    y: number;
}) => Math.hypot(a.x - b.x, a.y - b.y);
export function createWorld(now = Date.now()): WorldState {
    const positions = [[274, 307], [277, 341], [233, 344], [232, 297], [219, 284], [221, 288], [304, 283], [310, 270], [345, 209], [349, 204], [358, 213], [360, 222], [330, 180], [167, 406], [160, 415], [180, 422], [319, 108], [329, 100],[688,62],[664,42],[706,37],[685,20]];
    const state:WorldState={ players: {}, buildings: {}, depleted: {}, resourceHp: {}, tick: now, created: now, events: [], mobs: positions.map(([x, y], i) => {
        const point = [[x,y],[x+1,y],[x,y+1],[x-1,y],[x,y-1]].find(([a,b]) => terrainAt(a,b)!=='water' && !resourceAt(a+.5,b+.5));
        if(!point) throw new Error('Blocked monster spawn: '+i);
        const [a,b]=point;return {id:'slime-'+i,x:a+.5,y:b+.5,homeX:a+.5,homeY:b+.5,hp:54,windup:0,cooldown:0,deadUntil:0,hitUntil:0};
    }) };
    normalizeWorld(state,now);return state;
}
export function createPlayer(id: string, secret: string, name: string, color: number, now: number): Player {
    return { id, secret, name, x: SPAWN.x + color * .8, y: SPAWN.y, face: 'down', hp: 100, stamina: 100, inventory: { wood: 0, stone: 0, copper: 0, essence: 0,carrotSeed:6,tomatoSeed:6,wheatSeed:6,carrot:0,tomato:0,wheat:0 }, seen: now, actionAt: 0, dodgeUntil: 0, hitUntil: 0, swingUntil: 0, seq: 0, woodGathered: 0, kills: 0, color };
}
export function normalizeWorld(s:WorldState,now:number){
    s.plots??={};
    for(const p of Object.values(s.players)){
        p.level=floorLevel(p);
        for(const key of ['carrotSeed','tomatoSeed','wheatSeed'] as const)p.inventory[key]??=6;
        for(const key of ['carrot','tomato','wheat'] as const)p.inventory[key]??=0;
    }
    if((s.creatureVersion??0)<1){
        for(const [i,[kind,x,y]] of CREATURE_SPAWNS.entries()){
            const id=`${kind}-wild-${i}`;if(s.mobs.some(m=>m.id===id))continue;
            let point:{x:number;y:number}|undefined;
            for(let radius=0;radius<5&&!point;radius++)for(let dy=-radius;dy<=radius&&!point;dy++)for(let dx=-radius;dx<=radius;dx++){
                const a=x+dx,b=y+dy,t=terrainAt(a,b);
                if(t!=='water'&&t!=='cave-wall'&&!resourceAt(a,b)){point={x:a+.5,y:b+.5};break;}
            }
            if(point)s.mobs.push({id,kind,...point,homeX:point.x,homeY:point.y,hp:CREATURES[kind].hp,windup:0,cooldown:now,deadUntil:0,hitUntil:0});
        }
        s.creatureVersion=1;
    }
}
export function isBlocked(s: WorldState, x: number, y: number, level=0) {
    if(level>0){
        if(!atLevel(s.buildings,Math.floor(x),Math.floor(y),'floor',level))return true;
        return wallOccupies(s.buildings,x,y,level);
    }
    const t=terrainAt(Math.floor(x),Math.floor(y));
    if ((sceneAt(x)==='surface'&&(x<1||y<1||x>WORLD_SIZE-2||y>WORLD_SIZE-2)) || t==='water'||t==='cave-wall')
        return true;
    if(sceneAt(x)==='surface'&&Math.abs(x-CAVE_ENTRANCE.x)<2.6&&y<CAVE_ENTRANCE.y-1.4&&y>CAVE_ENTRANCE.y-4.7)return true;
    const r = resourceAt(x, y);
    if (r && r.kind !== 'berry' && !s.depleted[r.id])
        return true;
    return wallOccupies(s.buildings,x,y,level);
}
export function clearLine(s: WorldState, a: {x:number;y:number;level?:number}, b: {x:number;y:number;level?:number}) {
    if(floorLevel(a)!==floorLevel(b))return false;
    const steps = Math.ceil(distance(a,b) / .15);
    for (let i=1;i<steps;i++) {
        const x=a.x+(b.x-a.x)*i/steps, y=a.y+(b.y-a.y)*i/steps;
        if (isBlocked(s,x,y,floorLevel(a))) return false;
    }
    return true;
}
export function move(s: WorldState, p: {
    level?:number;
    x: number;
    y: number;
}, dx: number, dy: number) {
    const level=floorLevel(p);
    const free = (x: number, y: number) => {
        if(isBlocked(s,x-.2,y-.2,level)||isBlocked(s,x+.2,y-.2,level)||isBlocked(s,x-.2,y+.2,level)||isBlocked(s,x+.2,y+.2,level))return false;
        // Thin walls can fit between a body's corners: intersect the full footprint.
        for(let ty=Math.floor(y-.2);ty<=Math.floor(y+.2);ty++)for(let tx=Math.floor(x-.2);tx<=Math.floor(x+.2);tx++){
            if(!atLevel(s.buildings,tx,ty,'wall',level)&&atLevel(s.buildings,tx,ty,'fence',level)?.kind!=='fence')continue;
            if(wallRects(s.buildings,tx,ty,level).some(([rx,ry,w,h])=>x+.2>tx+rx/24&&x-.2<tx+(rx+w)/24&&y+.2>ty+ry/24&&y-.2<ty+(ry+h)/24))return false;
        }
        return true;
    };
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / .2));
    const axis=(amount:number,horizontal:boolean)=>{
        if(!amount)return;
        const clear=(fraction:number)=>free(p.x+(horizontal?amount*fraction:0),p.y+(horizontal?0:amount*fraction));
        let fraction=1;
        if(!clear(1)){
            // Clip to the same collision boundary for a frame-sized move and a delayed batch.
            let low=0,high=1;
            for(let n=0;n<14;n++){const middle=(low+high)/2;if(clear(middle))low=middle;else high=middle;}
            fraction=low;
        }
        if(horizontal)p.x+=amount*fraction;else p.y+=amount*fraction;
    };
    for (let i = 0; i < steps; i++) {axis(dx/steps,true);axis(dy/steps,false);}
}
function emit(s:WorldState,kind:GameEvent['kind'],x:number,y:number,amount:number,now:number,extra:Partial<GameEvent>={}){s.events.push({id:`${now}-${s.events.length}`,time:now,x,y,kind,amount,...extra});}
export function tickWorld(s: WorldState, now: number) {
    normalizeWorld(s,now);
    const dt = Math.max(0, Math.min(.5, (now - s.tick) / 1000));
    s.tick = now;
    s.events = s.events.filter(e => now - e.time < 1400);
    const players = Object.values(s.players).filter(p => now - p.seen < 8000);
    for (const p of players) {
        p.stamina = Math.min(100, p.stamina + dt * 17);
        if(p.pendingStrike && now>=p.pendingStrike.at){const strike=p.pendingStrike;p.pendingStrike=undefined;resolveAttack(s,p,strike.command,now);}
        // Old rooms may still contain buffered attacks. Only the already-started strike survives.
        if(p.attackQueue?.length)p.attackQueue=[];
        if (distance(p, SPAWN) < 2 && now > p.hitUntil + 1500)
            p.hp = Math.min(100, p.hp + dt * 8);
    }
    for (const mob of s.mobs) {
        const kind=mob.kind??'slime',stats=CREATURES[kind];
        mob.movingUntil=0;
        if (mob.hp <= 0) {
            if (now >= mob.deadUntil) {
                mob.hp = stats.hp;
                mob.x = mob.homeX;
                mob.y = mob.homeY;
                mob.windup=0;mob.chargeUntil=0;mob.attackAt=undefined;
            }
            else
                continue;
        }
        // Hurt and the visible landing/recovery frames finish before locomotion resumes.
        const recoveryAt=mob.attackAt??(mob.cooldown?mob.cooldown-CREATURES[mob.kind??'slime'].cooldown:0);
        if(now<mob.hitUntil||(recoveryAt&&now>=recoveryAt&&now<recoveryAt+350&&!mob.chargeUntil))continue;
        const beforeX=mob.x,beforeY=mob.y;
        let target: Player | undefined, closest = 8;
        for (const p of players) {
            const d = distance(p, mob);
            if (floorLevel(p)===0&&sceneAt(p.x)===sceneAt(mob.x)&&d < closest && distance(p, SPAWN) > 7) {
                target = p;
                closest = d;
            }
        }
        const hurt=(p:Player,amount:number)=>{
            if(now<p.dodgeUntil||now<p.hitUntil||floorLevel(p)!==0)return;
            p.hp-=amount;p.hurtAt=now;p.hitUntil=now+650;
            emit(s,'hurt',p.x,p.y,amount,now,{actorId:mob.id,level:0});
            const d=distance(p,mob)||1;move(s,p,(p.x-mob.x)/d*.4,(p.y-mob.y)/d*.4);
        };
        if(kind==='boar'&&(mob.chargeUntil??0)>now){
            const steps=Math.max(1,Math.ceil(8*dt/.2));
            for(let i=0;i<steps;i++){move(s,mob,(mob.chargeX??0)*8*dt/steps,(mob.chargeY??0)*8*dt/steps);
                for(const p of players)if(distance(p,mob)<1.1&&!mob.chargeHits?.includes(p.id)&&clearLine(s,mob,p)){hurt(p,stats.damage);(mob.chargeHits??=[]).push(p.id);}}
            mob.movingUntil=now+250;continue;
        }
        if(mob.chargeUntil&&now>=mob.chargeUntil)mob.chargeUntil=0;
        if (mob.windup) {
            if (now >= mob.windup) {
                mob.attackAt=now;
                if(kind==='boar'){
                    const dx=(mob.attackX??mob.x)-mob.x,dy=(mob.attackY??mob.y)-mob.y,n=Math.hypot(dx,dy)||1;
                    mob.chargeX=dx/n;mob.chargeY=dy/n;mob.chargeUntil=now+550;mob.chargeHits=[];
                }else if(kind==='mushroom'){
                    const aim={x:mob.attackX??mob.x,y:mob.attackY??mob.y};
                    emit(s,'spore',aim.x,aim.y,0,now,{actorId:mob.id});
                    for(const p of players)if(distance(p,aim)<stats.reach&&distance(p,mob)<6&&clearLine(s,mob,p))hurt(p,stats.damage);
                }else if(target&&closest<stats.reach&&clearLine(s,mob,target))hurt(target,stats.damage);
                mob.windup = 0;
                mob.cooldown = now + stats.cooldown;
            }
            continue;
        }
        if (target) {
            mob.face=Math.abs(target.x-mob.x)>Math.abs(target.y-mob.y)?target.x>mob.x?'right':'left':target.y>mob.y?'down':'up';
            if (closest < stats.range && now >= mob.cooldown){
                mob.windup = now + stats.windup;mob.attackX=target.x;mob.attackY=target.y;
            }
            else if (closest > 1.05) {
                const speed = stats.speed;
                move(s, mob, (target.x - mob.x) / closest * speed * dt, (target.y - mob.y) / closest * speed * dt);
            }
        }
        else if (players.some(p => distance(p, mob) < 16)) {
            const x = mob.homeX + Math.sin(now / 5000 + mob.homeX) * 1.5, y = mob.homeY + Math.cos(now / 6200 + mob.homeY) * 1.5;
            const d = Math.hypot(x - mob.x, y - mob.y);
            if (d > .1)
                move(s, mob, (x - mob.x) / d * .45 * dt, (y - mob.y) / d * .45 * dt);
        }
        if(Math.hypot(mob.x-beforeX,mob.y-beforeY)>.00001)mob.movingUntil=now+250;
    }
    for (const p of players)
        if (p.hp <= 0) {
            p.level=0;
            p.x = SPAWN.x;
            p.y = SPAWN.y;
            p.hp = 75;
            p.hitUntil = now + 3000;
        }
}
export function buildCost(s:WorldState,x:number,y:number,part:Part,level=0){
    if(part!=='stairs')return COSTS[part];
    const missing=[[0,0],[1,0],[0,1],[1,1]].filter(([dx,dy])=>!atLevel(s.buildings,x+dx,y+dy,'floor',level+1)).length;
    return {wood:12+missing*2,stone:4};
}
export function canBuild(s:WorldState,p:Player,x:number,y:number,part:Part):string|null{
    const level=floorLevel(p);
    if(sceneAt(p.x)==='mine')return '矿洞内无法建造';
    if(!Number.isInteger(x)||!Number.isInteger(y)||x<1||y<1||x>=511||y>=511||!Object.hasOwn(COSTS,part))return '无法放置';
    if(distance(p,{x:x+.5,y:y+.5})>5)return '距离太远';
    if(terrainAt(x,y)==='water')return '需要陆地';
    if(Math.hypot(x+.5-SPAWN.x,y+.5-SPAWN.y)<1.6)return '营火区域';
    if(Math.hypot(x+.5-CAVE_ENTRANCE.x,y+.5-CAVE_ENTRANCE.y)<5)return '保留洞口通道';
    const resource=level===0?resourceAt(x,y):undefined;
    if(resource&&!s.depleted[resource.id])return '先清理资源';
    if(s.plots?.[plotKey(x,y)]&&level===0)return '这里是耕地';
    if(atLevel(s.buildings,x,y,part,level))return '已被占用';
    if(part!=='floor'&&!atLevel(s.buildings,x,y,'floor',level))return '需要地板';
    if(part==='floor'&&level>0){
        if(!atLevel(s.buildings,x,y,'floor',level-1))return '楼下需要地板支撑';
        if(atLevel(s.buildings,x,y,'roof',level-1))return '先拆除下方屋顶';
    }
    if(layer(part)==='wall'&&Object.values(s.players).some(q=>floorLevel(q)===level&&distance(q,{x:x+.5,y:y+.5})<.8))return '有人站在这里';
    if(part==='stairs'){
        if(level>=MAX_LEVEL)return '最高三层';
        for(const [dx,dy]of[[0,0],[1,0],[0,1],[1,1]]){
            if(!atLevel(s.buildings,x+dx,y+dy,'floor',level))return '楼梯需要二乘二地板';
            if(atLevel(s.buildings,x+dx,y+dy,'roof',level))return '先拆除楼梯上方屋顶';
            if(atLevel(s.buildings,x+dx,y+dy,'wall',level+1))return '楼上出口被占用';
        }
    }
    if(part==='roof'&&atLevel(s.buildings,x,y,'floor',level+1))return '上方已有楼层';
    for(const [key,count]of Object.entries(buildCost(s,x,y,part,floorLevel(p))))if(p.inventory[key as keyof Inventory]<(count??0))return '材料不足';
    return null;
}
function traverseStairs(s:WorldState,p:Player,now:number,direction:'ascend'|'descend'|'either',target?:string){
    if(now<(p.portalUntil??0)||now<p.swingUntil)return false;
    const level=floorLevel(p),up=direction!=='descend',down=direction!=='ascend';
    const stairs=Object.values(s.buildings).filter(b=>b.kind==='stairs'&&(!target||b.id===target)&&((up&&floorLevel(b)===level)||(down&&floorLevel(b)===level-1))&&distance(p,{x:b.x+.5,y:b.y+.5})<2.3)
        .sort((a,b)=>Math.abs(floorLevel(a)-level)-Math.abs(floorLevel(b)-level)||distance(p,a)-distance(p,b))[0];
    if(!stairs)return false;
    const destination=floorLevel(stairs)===level?level+1:level-1;
    const choices=[[0,0],[1,0],[0,1],[1,1]].map(([dx,dy])=>({x:stairs.x+dx+.5,y:stairs.y+dy+.5}));
    const point=choices.find(v=>!isBlocked(s,v.x,v.y,destination));
    if(!point)return false;
    p.level=destination;p.x=point.x;p.y=point.y;p.portalUntil=now+500;p.moveCredit=0;p.movingUntil=0;p.pendingStrike=undefined;
    return true;
}
function farmCommand(s:WorldState,p:Player,c:Command,now:number):string|null{
    if(floorLevel(p)>0||sceneAt(p.x)==='mine')return '需要地表土地';
    if(now<Math.max(p.actionAt,p.swingUntil,p.workUntil??0))return null;
    const x=Math.floor(c.x??-1),y=Math.floor(c.y??-1),key=plotKey(x,y);
    if(distance(p,{x:x+.5,y:y+.5})>2.7)return '距离太远';
    s.plots??={};let plot=s.plots[key];
    const details={actorId:p.id,commandId:c.id,level:0,crop:c.crop};
    if(c.type==='till'){
        if(plot)return null;
        const terrain=terrainAt(x,y),r=resourceAt(x,y);
        if(!['grass','forest'].includes(terrain)||(r&&!s.depleted[r.id])||atLevel(s.buildings,x,y,'floor')||distance({x:x+.5,y:y+.5},SPAWN)<2)return '这里无法开垦';
        if(Object.keys(s.plots).length>=1200)return '耕地已满';
        plot=s.plots[key]={x,y,progress:0,updated:now,wetUntil:0};
    }else{
        if(!plot)return '先用锄头开垦';
        growPlot(plot,now);
        if(c.type==='plant'){
            if(!c.crop||!Object.hasOwn(CROPS,c.crop))return '选择种子';
            if(plot.crop)return '这里已经种植';
            const seed=CROPS[c.crop].seed;if(p.inventory[seed]<=0)return '种子不足';
            p.inventory[seed]--;plot.crop=c.crop;plot.progress=0;plot.updated=now;
        }else if(c.type==='water'){
            plot.wetUntil=now+FARM_WATER_MS;
        }else if(c.type==='harvest'){
            if(!plot.crop||cropProgress(plot,now)<CROPS[plot.crop].seconds)return null;
            const crop=plot.crop,info=CROPS[crop];p.inventory[crop]+=info.yield;p.inventory[info.seed]+=2;
            emit(s,'harvest',x+.5,y+.5,info.yield,now,{...details,crop});
            plot.crop=undefined;plot.progress=0;plot.updated=now;p.actionAt=now+250;
            return null;
        }
    }
    const action:WorkAction=c.type==='till'?'hoe':c.type==='water'?'water':'plant';
    const start=Number.isFinite(c.issuedAt)?Math.max(now-2000,Math.min(now,c.issuedAt!)):now;
    p.workAction=action;p.workStart=start;p.workUntil=start+WORK_TIMING[action].duration;p.actionAt=now+WORK_TIMING[action].duration;
    p.swingUntil=p.workUntil;p.swingFace=c.face??p.face;p.moveCredit=Math.max(0,(now-p.swingUntil)/1000);
    emit(s,c.type as 'till'|'plant'|'water',x+.5,y+.5,0,now,details);
    return null;
}
function runCommand(s: WorldState, p: Player, c: Command, now: number): string | null {
    if(['till','plant','water','harvest'].includes(c.type))return farmCommand(s,p,c,now);
    if(c.type==='eat'){if(c.crop&&Object.hasOwn(CROPS,c.crop)&&CROPS[c.crop].food>0&&p.inventory[c.crop]>0&&p.hp<100){p.inventory[c.crop]--;p.hp=Math.min(100,p.hp+CROPS[c.crop].food);}return null;}
    if(c.type==='ascend'||c.type==='descend'){traverseStairs(s,p,now,c.type,c.target);return null;}
    if (c.type === 'heal') {
        if (p.inventory.essence > 0 && p.hp < 100) { p.inventory.essence--; p.hp = Math.min(100,p.hp+30); }
        return null;
    }
    if (c.type === 'dodge') {
        if(now<p.swingUntil)return null;
        if (now < p.dodgeUntil + 450 || p.stamina < 28)
            return null;
        p.stamina -= 28;
        p.dodgeUntil = now + 330;
        p.dodgeMoveCredit = .33;
        p.dodgeMoveUntil = p.dodgeUntil + 1000;
        emit(s, 'dodge', p.x, p.y, 0, now);
        return null;
    }
    if (c.type === 'interact') {
        if(!c.target && transitionScene(p,now,2))return null;
        if(traverseStairs(s,p,now,'either',c.target))return null;
        if(!c.target){const plot=Object.values(s.plots??{}).filter(v=>v.crop&&cropProgress(v,now)>=CROPS[v.crop].seconds&&distance(p,v)<2).sort((a,b)=>distance(p,a)-distance(p,b))[0];if(plot)return farmCommand(s,p,{...c,type:'harvest',x:plot.x,y:plot.y},now);}
        const doorDistance=(b:Building)=>distance(p,{x:b.x+.5,y:b.y+.5});
        const door=c.target?s.buildings[c.target]:Object.values(s.buildings).filter(b=>b.kind==='door'&&floorLevel(b)===floorLevel(p)&&doorDistance(b)<2).sort((a,b)=>doorDistance(a)-doorDistance(b))[0];
        // Explicit pointer targets obey exactly the same authoritative range and type checks.
        if(!door || door.kind!=='door' || floorLevel(door)!==floorLevel(p)||doorDistance(door)>=2)return null;
        if(door.open){const closing={...s.buildings,[door.id]:{...door,open:false}},rects=wallRects(closing,door.x,door.y,floorLevel(door));
            if(Object.values(s.players).some(q=>floorLevel(q)===floorLevel(p)&&now-q.seen<8000&&rects.some(([x,y,w,h])=>q.x+.2>door.x+x/24&&q.x-.2<door.x+(x+w)/24&&q.y+.2>door.y+y/24&&q.y-.2<door.y+(y+h)/24)))return '门口有人';
        }
        door.open=!door.open;emit(s,'door',door.x+.5,door.y+.5,0,now,{actorId:p.id,commandId:c.id,level:floorLevel(p)});
        return null;
    }
    if (c.type === 'build') {
        const part = c.part;
        if (!part || !Object.hasOwn(COSTS,part))
            return '无效构件';
        const x = Math.floor(c.x ?? -1), y = Math.floor(c.y ?? -1), error = canBuild(s, p, x, y, part);
        if (error)
            return error;
        for (const [key, count] of Object.entries(buildCost(s,x,y,part,floorLevel(p))))
            p.inventory[key as keyof Inventory] -= count || 0;
        const level=floorLevel(p),id=buildingKey(x,y,part,level);
        s.buildings[id]={id,x,y,kind:part,open:part==='door',level};
        if(part==='stairs')for(const [dx,dy]of[[0,0],[1,0],[0,1],[1,1]]){const key=buildingKey(x+dx,y+dy,'floor',level+1);s.buildings[key]??={id:key,x:x+dx,y:y+dy,kind:'floor',level:level+1};}
        const start=Number.isFinite(c.issuedAt)?Math.max(now-2000,Math.min(now,c.issuedAt!)):now;
        p.workAction='hammer';p.workStart=start;p.workUntil=start+WORK_TIMING.hammer.duration;p.swingUntil=p.workUntil;p.swingFace=c.face??p.face;p.moveCredit=Math.max(0,(now-p.swingUntil)/1000);
        emit(s,'build',x+.5,y+.5,0,now,{actorId:p.id,commandId:c.id,level});
        return null;
    }
    if (c.type === 'remove') {
        const x = Math.floor(c.x ?? -1), y = Math.floor(c.y ?? -1);
        if (distance(p, { x: x + .5, y: y + .5 }) > 5)
            return '距离太远';
        const level=floorLevel(p),b=atLevel(s.buildings,x,y,'roof',level)||atLevel(s.buildings,x,y,'stairs',level)||atLevel(s.buildings,x,y,'wall',level)||atLevel(s.buildings,x,y,'floor',level);
        if (!b)
            return null;
        if(b.kind==='floor'&&atLevel(s.buildings,x,y,'floor',level+1))return '上层需要这块地板支撑';
        if(b.kind==='floor'&&Object.values(s.buildings).some(q=>q.kind==='stairs'&&floorLevel(q)===level&&x>=q.x&&x<=q.x+1&&y>=q.y&&y<=q.y+1))return '楼梯需要这块地板支撑';
        if(b.kind==='floor'&&level>0&&Object.values(s.players).some(q=>floorLevel(q)===level&&Math.abs(q.x-x-.5)<.7&&Math.abs(q.y-y-.5)<.7))return '有人站在这里';
        if(b.kind==='floor'&&level>0){
            const without={...s.buildings};delete without[b.id];
            for(const q of Object.values(s.players).filter(q=>floorLevel(q)>=level&&now-q.seen<8000)){
                if(!canReachGround(without,q.x,q.y,floorLevel(q)))return '保留通往楼梯的通路';
            }
        }
        if(b.kind==='stairs'&&Object.values(s.players).some(q=>floorLevel(q)>level&&now-q.seen<8000))return '先让楼上玩家下来';
        for (const [key, count] of Object.entries(b.kind==='stairs'?{wood:12,stone:4}:COSTS[b.kind]))
            p.inventory[key as keyof Inventory] += count || 0;
        delete s.buildings[b.id];
        emit(s,'build',x+.5,y+.5,0,now,{actorId:p.id,commandId:c.id,level});
        return null;
    }
    if (c.type === 'attack') {
        if(c.tool!=='axe'&&c.tool!=='pick'&&c.tool!=='sword')return null;
        // A held button sends the next action only when ready; early repeats never queue.
        if (now < Math.max(p.actionAt,p.swingUntil,p.dodgeUntil)) return null;
        const timing=TOOL_TIMING[c.tool==='sword'?'sword':c.tool==='pick'?'pick':'axe'];
        const issued=Number.isFinite(c.issuedAt)?Math.min(now,Math.max(now-2000,c.issuedAt!)):now;
        const start=Math.max(issued,p.actionAt,p.swingUntil,p.dodgeUntil);
        p.actionAt=now+timing.cooldown;p.swingStart=start;p.swingUntil=start+timing.duration;
        p.moveCredit=Math.min(INPUT_HISTORY_SECONDS,Math.max(0,(now-p.swingUntil)/1000));p.movingUntil=0;
        p.equipped=c.tool;
        p.swingFace=c.face&&['up','down','left','right'].includes(c.face)?c.face:p.face;
        if(c.tool!=='sword'){
            const r=c.target?RESOURCE_MAP.get(c.target):undefined;
            if(r&&!s.depleted[r.id]){
                if(distance(p,{x:r.x+.5,y:r.y+.5})>2.5)return '距离太远';
                const required=r.kind==='tree'||r.kind==='pine'||r.kind==='berry'?'axe':'pick';
                if(c.tool!==required)return required==='axe'?'使用斧头':'使用镐';
            }
        }
        p.pendingStrike={command:{...c},at:start+timing.contact};
        p.lastCommandId=c.id;
        if(p.pendingStrike.at<=now){const strike=p.pendingStrike;p.pendingStrike=undefined;return resolveAttack(s,p,strike.command,now);}
        return null;
    }
    return null;
}
function resolveAttack(s:WorldState,p:Player,c:Command,now:number):string|null{
        if (c.tool === 'sword') {
            const target = s.mobs.find(m => m.id === c.target && m.hp > 0 && floorLevel(p)===floorLevel(m) && distance(p, m) < 2.3) || s.mobs.filter(m => m.hp > 0 && floorLevel(p)===floorLevel(m) && distance(p, m) < 1.9).sort((a, b) => distance(p, a) - distance(p, b))[0];
            if (target && clearLine(s,p,target)) {
                target.hp -= 18;
                target.hitUntil = now + 350;
                target.windup = 0;target.chargeUntil=0;
                const d = distance(p, target) || 1;
                move(s, target, (target.x - p.x) / d * .5, (target.y - p.y) / d * .5);
                emit(s,'hit',target.x,target.y,18,now,{actorId:p.id,commandId:c.id,targetId:target.id,level:floorLevel(p)});
                if (target.hp <= 0) {
                    target.deadUntil = now + 90000;
                    const reward=CREATURES[target.kind??'slime'].reward;p.inventory.essence += reward;
                    p.kills++;
                    emit(s,'essence',target.x,target.y,reward,now,{actorId:p.id,commandId:c.id,level:floorLevel(p)});
                }
            }
            return null;
        }
        if(floorLevel(p)>0)return null;
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
        emit(s,'hit',r.x+.5,r.y+.5,1,now,{actorId:p.id,commandId:c.id,targetId:r.id,level:floorLevel(p)});
        if (hp <= 0) {
            s.depleted[r.id] = true;
            delete s.resourceHp[r.id];
            const item = r.kind === 'tree' || r.kind === 'pine' ? 'wood' : r.kind === 'copper' ? 'copper' : r.kind === 'berry' ? 'essence' : 'stone';
            const count = item === 'wood' ? 6 : item === 'stone' ? 5 : item === 'copper' ? 3 : 1;
            p.inventory[item] += count;
            if (item === 'wood')
                p.woodGathered += count;
            emit(s,item,r.x+.5,r.y+.5,count,now,{actorId:p.id,commandId:c.id,targetId:r.id,level:floorLevel(p)});
        }
        return null;
}
export function applyInput(s: WorldState, id: string, input: Input, now: number): string | null {
    normalizeWorld(s,now);
    const p = s.players[id];
    if (!p)
        return '角色不存在';
    if (!Number.isSafeInteger(input.seq) || input.seq <= p.seq)
        return null;
    const previousSeen=p.seen;
    const dt = Math.max(0, Math.min(INPUT_HISTORY_SECONDS, (now - previousSeen) / 1000));
    p.seen = now;
    p.seq = input.seq;
    let message: string | null = null,movementApplied=false;
    const applyMovement=()=>{
        if(movementApplied)return;movementApplied=true;
        // Locked time never becomes movement credit, including inputs arriving after unlock.
        const locked=now<p.swingUntil;
        const elapsed=Math.max(0,Math.min(INPUT_HISTORY_SECONDS,(now-Math.max(previousSeen,p.swingUntil))/1000));
        let credit=locked?0:Math.min(INPUT_HISTORY_SECONDS,(previousSeen<p.swingUntil?0:p.moveCredit??.05)+elapsed);
        const movements=Array.isArray(input.movements)?input.movements.slice(0,64):[{dx:input.dx,dy:input.dy,seconds:Math.min(.35,dt)}];
        if(locked)p.movingUntil=0;
        for(const segment of movements){
            const dx=Number.isFinite(segment.dx)?Math.max(-1,Math.min(1,segment.dx)):0;
            const dy=Number.isFinite(segment.dy)?Math.max(-1,Math.min(1,segment.dy)):0;
            const seconds=Number.isFinite(segment.seconds)?Math.max(0,Math.min(credit,segment.seconds)):0;
            const length=Math.max(1,Math.hypot(dx,dy));
            // Segments describe past prediction, so receipt time cannot choose their speed.
            // Each approved dodge grants at most 330 ms at 9 tiles/s, with a bounded delivery grace.
            const rolling=segment.speed===9 || (segment.speed===undefined && now<p.dodgeUntil);
            const dodgeValid=now<(p.dodgeMoveUntil??p.dodgeUntil);
            const dodgeCredit=dodgeValid?p.dodgeMoveCredit??Math.min(.33,Math.max(0,(p.dodgeUntil-now)/1000)):0;
            const fastSeconds=rolling?Math.min(seconds,Math.max(0,dodgeCredit)):0;
            const x=p.x,y=p.y;
            if(fastSeconds>0){move(s,p,dx/length*9*fastSeconds,dy/length*9*fastSeconds);p.dodgeMoveCredit=dodgeCredit-fastSeconds;}
            if(seconds>fastSeconds)move(s,p,dx/length*4.2*(seconds-fastSeconds),dy/length*4.2*(seconds-fastSeconds));
            credit-=seconds;
            if(Math.hypot(p.x-x,p.y-y)>.00001)p.movingUntil=now+220;
        }
        p.moveCredit=credit;
    };
    for (const command of (Array.isArray(input.commands) ? input.commands : []).slice(0, 5)) {
        // The client records movement before clicking and stops recording once the swing begins.
        // Interaction also uses the final walked-to position, especially when leaving a doorway.
        if(command.type!=='dodge')applyMovement();
        const result = runCommand(s, p, command, now);
        if (result)message = result;
    }
    applyMovement();
    transitionScene(p,now,.78);
    if (input.face && ['up', 'down', 'left', 'right'].includes(input.face))
        p.face = input.face;
    return message;
}
export function transitionScene(p:Player,now:number,radius:number){
    if(floorLevel(p)>0||now<p.swingUntil||now<(p.portalUntil??0))return false;
    const underground=sceneAt(p.x)==='mine',portal=underground?MINE.exit:CAVE_ENTRANCE;
    if(distance(p,portal)>radius)return false;
    const destination=underground?{x:CAVE_ENTRANCE.x,y:CAVE_ENTRANCE.y+2}:MINE.spawn;
    p.x=destination.x;p.y=destination.y;p.level=0;p.portalUntil=now+1800;p.face='down';p.attackQueue=[];p.pendingStrike=undefined;p.moveCredit=0;
    return true;
}
export function publicWorld(s: WorldState): WorldState { return { ...s, players: Object.fromEntries(Object.entries(s.players).map(([id, p]) => { const clean = { ...p }; delete clean.secret; return [id, clean]; })) }; }
