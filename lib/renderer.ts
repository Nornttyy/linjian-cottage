import { COLORS, resourcesInRect, resourceAt, SPAWN, WORLD_SIZE, terrainAt, regionAt, LANDMARKS, type Resource, sceneAt, MINE, CAVE_ENTRANCE, MINE_TORCHES } from './world';
import { canBuild, distance, type WorldState, type Player, type Part, type Tool } from './simulation';
import { HERO_SIZE, FIRE_SIZE, FIRE_FRAME_COUNT, FIRE_FRAME_MS, SLIME_SIZE, type Atlas, type Sprite } from './art';
import {material,terrainTile} from './tiles';
import {drawConnectedWall,floorWallInsets} from './connected-wall';
import {atmosphere,treeShadows} from './atmosphere';
import {heroFrame,heroFacing,toolTrailFrame,slimeFrame,type HeroSwing} from './animation';
import {roofVisibility} from './roof-visibility';
export const TILE = 24;
export function roofRect(x:number,y:number,ox:number,oy:number){return [x*TILE+ox,y*TILE+oy-22,24,24] as const;}
export function buildTarget(point:{x:number;y:number},s:WorldState,remove:boolean){
    if(remove){const roof=Object.values(s.buildings).filter(b=>b.kind==='roof'&&point.x>=b.x&&point.x<b.x+1&&point.y>=b.y-22/TILE&&point.y<b.y+2/TILE).sort((a,b)=>b.y-a.y)[0];if(roof)return{x:roof.x,y:roof.y};}
    return{x:Math.floor(point.x),y:Math.floor(point.y)};
}

export type View = {
    tool: Tool;
    part: Part;
    remove: boolean;
    pointer: {
        x: number;
        y: number;
    } | null;
    time: number;
    roomKey?: string;
    fadeUntil?: number;
    localSwing?: HeroSwing | null;
    motionElapsed?: number;
};
export type Position = {
    x: number;
    y: number;
    face: Player['face'];
    moving: boolean;
};
let ground: HTMLCanvasElement | undefined;
export function worldMap() { if (ground)
    return ground; ground = document.createElement('canvas'); ground.width = 512; ground.height = 512; const ctx = ground.getContext('2d')!; for (let y = 0; y < 512; y++)
    for (let x = 0; x < 512; x++) {
        ctx.fillStyle = COLORS[terrainAt(x, y)];
        ctx.fillRect(x, y, 1, 1);
    } return ground; }
export function pointerWorld(canvas: HTMLCanvasElement, pos: Position, x: number, y: number) { const box = canvas.getBoundingClientRect(); return { x: (x - box.left) * canvas.width / box.width / TILE + pos.x - canvas.width / 2 / TILE, y: (y - box.top) * canvas.height / box.height / TILE + pos.y - canvas.height / 2 / TILE }; }
export function pickResource(point: {
    x: number;
    y: number;
}, s: WorldState, p: Position): Resource | undefined {
    return resourcesInRect(p.x-9,p.y-9,p.x+9,p.y+9).filter(r => !s.depleted[r.id] && Math.abs(r.x - p.x) < 9 && Math.abs(r.y - p.y) < 9 && point.x >= r.x - .6 && point.x <= r.x + 1.6 && point.y >= r.y - (r.kind === 'tree' || r.kind === 'pine' ? 2 : 0) && point.y <= r.y + 1.1).sort((a, b) => b.y - a.y)[0];
}
function roofGroup(s: WorldState, p: Position) { const start = Math.floor(p.x) + ':' + Math.floor(p.y); const visited = new Set<string>(); if (!s.buildings[start + ':floor'])
    return visited; const todo = [start]; for (let i = 0; i < todo.length && i < 2048; i++) {
    const key = todo[i];
    if (visited.has(key) || !s.buildings[key + ':floor'])
        continue;
    visited.add(key);
    const [x, y] = key.split(':').map(Number);
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]])
        if (!visited.has(nx + ':' + ny))
            todo.push(nx + ':' + ny);
} return visited; }
type SlimeDrawPosition={x:number;y:number;fromX:number;fromY:number;toX:number;toY:number;started:number;duration:number;tick:number;lastDraw:number;dead:boolean;phase:string};
function slimeDrawPosition(positions:Map<string,SlimeDrawPosition>,m:WorldState['mobs'][number],time:number,tick:number,phase:string){
    let point=positions.get(m.id);
    const dead=m.hp<=0;
    if(!point||(point.phase!==phase&&phase!=='move')||point.dead!==dead||time<point.lastDraw||time-point.lastDraw>500||Math.hypot(m.x-point.toX,m.y-point.toY)>3){
        point={x:m.x,y:m.y,fromX:m.x,fromY:m.y,toX:m.x,toY:m.y,started:time,duration:0,tick,lastDraw:time,dead,phase};positions.set(m.id,point);return point;
    }
    const progress=point.duration?Math.max(0,Math.min(1,(time-point.started)/point.duration)):1;
    point.x=point.fromX+(point.toX-point.fromX)*progress;point.y=point.fromY+(point.toY-point.fromY)*progress;
    if(m.x!==point.toX||m.y!==point.toY){
        point.fromX=point.x;point.fromY=point.y;point.toX=m.x;point.toY=m.y;point.started=time;point.duration=Math.max(80,Math.min(120,tick-point.tick));
    }
    point.tick=tick;point.lastDraw=time;point.phase=phase;return point;
}

const slimeViews=new WeakMap<HTMLCanvasElement,{roomKey:string;created:number;poses:Map<string,{phase:string;started:number}>;positions:Map<string,SlimeDrawPosition>}>();

export function render(canvas: HTMLCanvasElement, s: WorldState, id: string, pos: Position, view: View, art: Atlas) {
    const w = Math.max(1, Math.floor(canvas.clientWidth / 2)), h = Math.max(1, Math.floor(canvas.clientHeight / 2));
    if (canvas.width !== w)
        canvas.width = w;
    if (canvas.height !== h)
        canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    const ox = Math.round(w / 2 - pos.x * TILE), oy = Math.round(h / 2 - pos.y * TILE), t = view.time;
    const minX = Math.floor(-ox / TILE) - 1, maxX = Math.ceil((w - ox) / TILE) + 1, minY = Math.floor(-oy / TILE) - 3, maxY = Math.ceil((h - oy) / TILE) + 4;
    const underground=sceneAt(pos.x)==='mine';
    for(let y=minY;y<maxY;y++)for(let x=minX;x<maxX;x++){
        terrainTile(ctx,art,x,y,ox,oy);
        const terrain=terrainAt(x,y),px=x*TILE+ox,py=y*TILE+oy;
        const detail=((x*73)^(y*137)^(Math.floor(x/5)*37))>>>0;
        if(terrain==='water'){
            ctx.globalAlpha=.16+.08*Math.sin(t/450+x+y);
            ctx.drawImage(art.spark,px+(x*7+y*3)%15,py+(y*11+x)%15,4,3);ctx.globalAlpha=1;
        }else if(detail%43===0&&(terrain==='grass'||terrain==='forest'||terrain==='marsh')){
            const name:Sprite=terrain==='marsh'?'reeds':terrain==='forest'?(detail%3?'tuft':'mushrooms'):'daisies';
            ctx.drawImage(art[name],px+6,py+6,12,12);
        }
        if(terrain==='cave-wall'&&terrainAt(x,y+1)==='cave-floor'){
            material(ctx,art['ground-cave-wall'],x,y,px,py+20,24,12);
            ctx.globalAlpha=.15;ctx.fillStyle='#556584';ctx.fillRect(px,py+30,24,2);ctx.globalAlpha=1;
        }
        if(terrain==='path'&&x>275&&x<291&&y>=317&&y<=320)material(ctx,art.bridge,x,y,px,py);
    }
    if(underground)for(let y=minY;y<maxY;y++)for(let x=minX;x<maxX;x++){
        if(terrainAt(x,y)==='cave-wall'&&terrainAt(x,y+1)==='cave-floor'){
            material(ctx,art['ground-cave-wall'],x,y,x*TILE+ox,y*TILE+oy+18,24,15);
            ctx.globalAlpha=.14;ctx.fillStyle='#556584';ctx.fillRect(x*TILE+ox,y*TILE+oy+32,24,2);ctx.globalAlpha=1;
        }
    }
    treeShadows(ctx,s,pos,art,ox,oy);
    const visible = (x: number, y: number) => x > minX - 4 && x < maxX + 4 && y > minY - 4 && y < maxY + 3;
    const sprite = (name: Sprite, x: number, y: number, width: number, height: number, alpha = 1, flip = false) => { ctx.save(); ctx.globalAlpha = alpha; const px = Math.round(x * TILE + ox), py = Math.round(y * TILE + oy); if (flip) {
        ctx.translate(px, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(art[name], -width / 2, py - height, width, height);
    }
    else
        ctx.drawImage(art[name], Math.round(px - width / 2), py - height, width, height); ctx.restore(); };
    for (const b of Object.values(s.buildings)) {
        if (b.kind === 'floor' && visible(b.x, b.y)) {
            const inset = floorWallInsets(s.buildings,b.x,b.y);
            if(inset.left || inset.right){
                ctx.save();ctx.beginPath();ctx.rect(b.x*TILE+ox+inset.left,b.y*TILE+oy,TILE-inset.left-inset.right,TILE);ctx.clip();
                material(ctx,art.floor,b.x,b.y,b.x*TILE+ox,b.y*TILE+oy);ctx.restore();
            }else material(ctx,art.floor,b.x,b.y,b.x*TILE+ox,b.y*TILE+oy);
        }
    }
    const fireX = (SPAWN.x) * TILE + ox, fireY = (SPAWN.y - 1.4) * TILE + oy;
    const drawables: {
        y: number;
        draw: () => void;
    }[] = [];
    if(!underground&&visible(SPAWN.x,SPAWN.y-1.4))drawables.push({y:SPAWN.y-1.4,draw:()=>{
        ctx.drawImage(art[`fire${Math.floor(t/FIRE_FRAME_MS)%FIRE_FRAME_COUNT}`],Math.round(fireX-FIRE_SIZE.anchorX),Math.round(fireY-FIRE_SIZE.anchorY),FIRE_SIZE.width,FIRE_SIZE.height);
    }});
    for (const r of resourcesInRect(minX-4,minY-4,maxX+4,maxY+3)) {
        if (!visible(r.x, r.y))
            continue;
        if (s.depleted[r.id]) {
            if (r.kind === 'tree' || r.kind === 'pine')
                sprite('stump', r.x + .5, r.y + 1, 14, 12);
            continue;
        }
        drawables.push({ y: r.y + .8, draw: () => { const tree = r.kind === 'tree' || r.kind === 'pine', near = tree && Math.abs(pos.x - r.x - .5) < 1.1 && pos.y < r.y + .8 && pos.y > r.y - 1.6; const recent = s.events.some(e => e.kind === 'hit' && t - e.time < 200 && Math.abs(e.x - r.x - .5) < .1 && Math.abs(e.y - r.y - .5) < .1); sprite(r.kind, r.x + .5 + (recent ? Math.sin(t * .06) * .06 : 0), r.y + 1, tree ? 43 : r.kind === 'berry' ? 24 : 25, tree ? 58 : r.kind === 'berry' ? 21 : 24, near ? .5 : 1); } });
    }
    for (const b of Object.values(s.buildings)) {
        if (!visible(b.x, b.y) || b.kind === 'floor' || b.kind === 'roof')
            continue;
        drawables.push({ y: b.y + .9, draw: () => {
                const fade = b.y > pos.y - .3 && b.y < pos.y + 1.2 && Math.abs(b.x + .5 - pos.x) < 1.05;
                ctx.save();ctx.globalAlpha=fade?.42:1;
                drawConnectedWall(ctx,art,s.buildings,b,ox,oy);ctx.restore();
            } });
    }
    if(!underground&&visible(CAVE_ENTRANCE.x,CAVE_ENTRANCE.y))drawables.push({y:CAVE_ENTRANCE.y-1.6,draw:()=>{
        const img=art['cave-entrance'],width=168,height=Math.round(width*img.height/img.width);
        ctx.drawImage(img,Math.round(CAVE_ENTRANCE.x*TILE+ox-width/2),Math.round(CAVE_ENTRANCE.y*TILE+oy-height+12),width,height);
    }});
    if(underground){
        for(const [x,y] of MINE_TORCHES)if(visible(x,y))drawables.push({y:y+1,draw:()=>ctx.drawImage(art.torch,x*TILE+ox+5,y*TILE+oy-10,14,27)});
        drawables.push({y:MINE.exit.y,draw:()=>ctx.drawImage(art['door-open'],MINE.exit.x*TILE+ox-20,MINE.exit.y*TILE+oy-34,40,42)});
    }
    let slimeView=slimeViews.get(canvas);
    const roomKey=view.roomKey??'';
    if(!slimeView||slimeView.roomKey!==roomKey||slimeView.created!==s.created){slimeView={roomKey,created:s.created,poses:new Map(),positions:new Map()};slimeViews.set(canvas,slimeView);}
    for(const m of s.mobs){
        if(!visible(m.x,m.y))continue;
        // Keep the last received movement state until a newer snapshot changes it.
        const moving=(m.movingUntil??0)>s.tick;
        const contact=m.windup||(m.cooldown?m.cooldown-1100:0),recovering=contact&&t>=contact&&t<contact+350;
        const phase=m.hp<=0?'death':t<m.hitUntil?'hurt':m.windup>t||recovering?'attack':moving?'move':'idle';
        let pose=slimeView.poses.get(m.id);
        if(!pose||pose.phase!==phase||t<pose.started){pose={phase,started:t};slimeView.poses.set(m.id,pose);}
        const frame=slimeFrame(m,t,moving,t-pose.started);if(!frame)continue;
        const point=slimeDrawPosition(slimeView.positions,m,t,s.tick,phase);
        drawables.push({y:point.y,draw:()=>{
            ctx.fillStyle='#48615730';ctx.fillRect(point.x*TILE+ox-8,point.y*TILE+oy-2,16,3);
            ctx.drawImage(art[frame],Math.round(point.x*TILE+ox-SLIME_SIZE.anchorX),Math.round(point.y*TILE+oy-SLIME_SIZE.anchorY),SLIME_SIZE.width,SLIME_SIZE.height);
            if(m.windup>t){ctx.globalAlpha=.45;ctx.drawImage(art.spark,point.x*TILE+ox-7,point.y*TILE+oy-29,14,14);ctx.globalAlpha=1;}
            if(m.hp>0&&(m.hp<54||distance(pos,m)<4)){ctx.fillStyle='#58724b';ctx.fillRect(point.x*TILE+ox-11,point.y*TILE+oy-34,22,3);ctx.fillStyle='#bbe685';ctx.fillRect(point.x*TILE+ox-10,point.y*TILE+oy-33,20*m.hp/54,1);}
        }});
    }
    for (const p of Object.values(s.players)) {
        if (t - p.seen > 15000 && p.id !== id)
            continue;
        const local = p.id === id, point = local ? pos : p;
        if (!visible(point.x, point.y))
            continue;
        drawables.push({ y: point.y, draw: () => {
                const moving=local?pos.moving:t<(p.movingUntil??0),swing=local?view.localSwing:undefined;
                const face=heroFacing(p,local?pos.face:p.face,t,swing);
                const frame=heroFrame(p,face,moving,t,local?view.tool:p.equipped??'axe',swing,local?view.motionElapsed:undefined);
                const trail=toolTrailFrame(p,t,swing),px=Math.round(point.x*TILE+ox),py=Math.round(point.y*TILE+oy);
                const drawTrail=()=>{if(!trail||!art[trail])return;const size=trail.startsWith('trail-sword')?56:44;
                    ctx.save();ctx.translate(px,py-12);ctx.rotate(face==='down'?Math.PI/2:face==='up'?-Math.PI/2:face==='left'?Math.PI:0);
                    ctx.globalAlpha=.8;ctx.drawImage(art[trail],-size/2,-size/2,size,size);ctx.restore();};
                ctx.fillStyle='#48615730';ctx.fillRect(point.x*TILE+ox-6,point.y*TILE+oy-2,12,3);
                if(face==='up')drawTrail();
                ctx.save();ctx.translate(px,py);
                if(face==='left')ctx.scale(-1,1);ctx.drawImage(art[frame],-HERO_SIZE.anchorX,-HERO_SIZE.anchorY,HERO_SIZE.width,HERO_SIZE.height);ctx.restore();
                if(face!=='up')drawTrail();
                if(!local){ctx.fillStyle=['#ffe7a1','#f8a77d','#7cc9e2','#c8a0e8'][p.color%4];ctx.fillRect(point.x*TILE+ox-3,point.y*TILE+oy-37,6,2);}
            } });
    }
    drawables.sort((a, b) => a.y - b.y).forEach(d => d.draw());
    const indoors = roofGroup(s, pos), roofs = Object.values(s.buildings).filter(b => b.kind === 'roof');
    const roofOpacity = roofVisibility(canvas, `${view.roomKey ?? s.created}:${id}:${sceneAt(pos.x)}`, roofs, indoors, t);
    for (const b of roofs)
        if (visible(b.x, b.y)) {
            ctx.globalAlpha = roofOpacity.get(b.x + ':' + b.y) ?? 1;
            material(ctx,art.roof,b.x,b.y,...roofRect(b.x,b.y,ox,oy));
            const [rx,ry]=roofRect(b.x,b.y,ox,oy);
            if(!s.buildings[`${b.x}:${b.y+1}:roof`]){ctx.drawImage(art.beam,0,0,art.beam.width,Math.max(1,art.beam.height/8),rx,ry+22,24,3);}
            if(!s.buildings[`${b.x}:${b.y-1}:roof`]){ctx.drawImage(art.beam,0,0,art.beam.width,Math.max(1,art.beam.height/8),rx,ry,24,2);}
            ctx.globalAlpha = 1;
        }
    if (view.tool === 'build') {
        ctx.strokeStyle = '#e8edc426';
        ctx.lineWidth = .5;
        for (let y = Math.floor(pos.y) - 5; y <= pos.y + 5; y++)
            for (let x = Math.floor(pos.x) - 5; x <= pos.x + 5; x++)
                ctx.strokeRect(x * TILE + ox, y * TILE + oy, TILE, TILE);
        if (view.pointer) {
            const cell=buildTarget(view.pointer,s,view.remove);const x=cell.x,y=cell.y,p=s.players[id];
            const valid = p && !canBuild(s, { ...p, ...pos }, x, y, view.part);
            ctx.fillStyle = view.remove ? '#c5746455' : valid ? '#dae9a74d' : '#bd6e6055';
            ctx.fillRect(x * TILE + ox, y * TILE + oy, 24, 24);
            ctx.strokeStyle = view.remove ? '#dda58e' : valid ? '#e5f0bc' : '#de9b81';
            ctx.lineWidth = 1;
            ctx.strokeRect(x * TILE + ox + .5, y * TILE + oy + .5, 23, 23);
            if (!view.remove) {
                ctx.globalAlpha = .55;
                if(view.part==='roof')material(ctx,art.roof,x,y,...roofRect(x,y,ox,oy));else if(view.part==='floor')ctx.drawImage(art.floor,x*TILE+ox,y*TILE+oy,24,24);else drawConnectedWall(ctx,art,s.buildings,{id:'preview',x,y,kind:view.part,open:view.part==='door'},ox,oy);
                ctx.globalAlpha = 1;
            }
        }
    }
    else if (view.pointer) {
        const target = pickResource(view.pointer, s, pos);
        if (target && distance(pos, { x: target.x + .5, y: target.y + .5 }) < 2.8) {
            ctx.strokeStyle = '#edf1bf';
            ctx.lineWidth = 1;
            ctx.strokeRect(target.x * TILE + ox + 2, target.y * TILE + oy + 3, 20, 17);
        }
    }
    for (const e of s.events) {
        const age = t - e.time;
        if (age < 0 || age > 1200)
            continue;
        const f = age / 1200;
        ctx.globalAlpha = 1 - f;
        const x = e.x * TILE + ox, y = e.y * TILE + oy - 20 - f * 18;
        if (e.kind === 'hit' || e.kind === 'hurt') {
            ctx.fillStyle = e.kind === 'hurt' ? '#efd1ac' : '#f6ecc3';
            ctx.font = 'bold 8px monospace';
            if (e.amount > 1)
                ctx.fillText(String(e.amount), x - 4, y);
            if(age<340){
                const progress=age/340,resource=e.kind==='hit'&&e.amount===1?resourceAt(Math.floor(e.x),Math.floor(e.y)):undefined;
                const particle=resource?(resource.kind==='tree'||resource.kind==='pine'?art.wood:resource.kind==='berry'?art.berry:resource.kind==='copper'?art['copper-icon']:art['stone-icon']):art.spark;
                ctx.globalAlpha=1-progress;
                for(let i=0;i<4;i++){
                    const angle=i*1.7,dx=Math.round(e.x*TILE+ox+Math.cos(angle)*progress*16),dy=Math.round(e.y*TILE+oy-12+Math.sin(angle)*progress*9-8*Math.sin(progress*Math.PI));
                    ctx.drawImage(particle,dx-2,dy-2,resource?4:6,resource?4:6);
                }
            }
        }
        else if (e.amount) {
            const type = e.kind === 'wood' ? 'stump' : e.kind === 'essence' ? 'slime' : e.kind;
            const icon = art[type as Sprite];
            if (icon)
                ctx.drawImage(icon, x - 11, y - 8, 9, 9);
            ctx.fillStyle = '#fff6cb';
            ctx.font = 'bold 8px monospace';
            ctx.fillText('+' + e.amount, x, y);
        }
        else {
            ctx.fillStyle = '#e2d4a4';
            for (let i = 0; i < 5; i++)
                ctx.fillRect(x + (i - 2) * f * 8, y + 10 - Math.sin(f * Math.PI) * 9, 2, 2);
        }
        ctx.globalAlpha = 1;
    }
    atmosphere(ctx,s,pos,art,t,w,h,ox,oy);
    if(view.fadeUntil&&t<view.fadeUntil){ctx.fillStyle=`rgba(42,52,64,${Math.max(0,(view.fadeUntil-t)/500)})`;ctx.fillRect(0,0,w,h);}
}

export function paintMap(c:HTMLCanvasElement,s:WorldState,id:string){
    const ctx=c.getContext('2d')!;c.width=c.height=512;ctx.imageSmoothingEnabled=false;
    const local=s.players[id],mine=local&&sceneAt(local.x)==='mine',scale=mine?512/MINE.size:1,origin=mine?MINE.x:0;
    if(mine){for(let y=0;y<MINE.size;y++)for(let x=0;x<MINE.size;x++){ctx.fillStyle=COLORS[terrainAt(x+MINE.x,y)];ctx.fillRect(x*scale,y*scale,Math.ceil(scale),Math.ceil(scale));}}
    else ctx.drawImage(worldMap(),0,0);
    for(const l of mine?[{...MINE.exit,name:'出口'}]:LANDMARKS){const x=(l.x-origin)*scale,y=l.y*scale;ctx.fillStyle='#627454';ctx.fillRect(x-2,y-2,5,5);ctx.font='11px sans-serif';ctx.fillStyle='#fff2cc';ctx.fillText(l.name,x+8,y+4);}
    for(const p of Object.values(s.players)){if((sceneAt(p.x)==='mine')!==Boolean(mine))continue;ctx.fillStyle=p.id===id?'#fff6c0':'#e8a36b';ctx.beginPath();ctx.arc((p.x-origin)*scale,p.y*scale,4,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#627454';ctx.stroke();}
}

export { regionAt, WORLD_SIZE };
