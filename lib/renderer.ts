import { COLORS, resourcesInRect, resourceAt, SPAWN, WORLD_SIZE, terrainAt, regionAt, LANDMARKS, type Resource, sceneAt, MINE, CAVE_ENTRANCE, MINE_TORCHES } from './world';
import { distance, type WorldState, type Player, type Part, type Tool } from './simulation';
import { ART_DENSITY, HERO_SIZE, FIRE_SIZE, FIRE_FRAME_COUNT, FIRE_FRAME_MS, SLIME_SIZE, CROP_SIZE, type Atlas, type Sprite } from './art';
import {material,terrainTile} from './tiles';
import {drawConnectedWall,connectedWallLayers,drawWallLayer,floorWallInsets} from './connected-wall';
import {atmosphere,treeShadows} from './atmosphere';
import {heroFrame,heroFacing,toolTrailFrame,creatureFrame,creatureFacing,workFrame,type HeroSwing,type WorkSwing} from './animation';
import {atLevel,floorLevel,floorGroup,layer,MAX_LEVEL,type Building} from './structures';
import {cropStage,soilOpacity,type Plot} from './farming';
import {CREATURES} from './creatures';
import type {GameEvent} from './simulation';
import {roofVisibility} from './roof-visibility';
import {buildGuide,drawBuildGrid,drawBuildTarget} from './build-guide';
import {drawLandscape,resourceSprite} from './landscape';
import {NATURAL_LANDMARKS,landmarkCenter} from './map-features';
export const TILE = 24;
export function roofRect(x:number,y:number,ox:number,oy:number){return [x*TILE+ox,y*TILE+oy-22,24,24] as const;}
export function buildTarget(point:{x:number;y:number},s:WorldState,remove:boolean,level=0){
    if(remove){const roof=Object.values(s.buildings).filter(b=>b.kind==='roof'&&floorLevel(b)===level&&point.x>=b.x&&point.x<b.x+1&&point.y>=b.y-22/TILE&&point.y<b.y+2/TILE).sort((a,b)=>b.y-a.y)[0];if(roof)return{x:roof.x,y:roof.y};}
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
    localWork?:WorkSwing|null;
    predictedEvents?:(GameEvent&{predicted?:boolean})[];
    suppressedHits?:Record<string,number>;
    settledCommands?:Set<string>;
};
export type Position = {
    level?:number;
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
    }
    // A quiet canopy pattern makes wooded regions legible without hiding paths.
    ctx.fillStyle='#3d71532e';
    for(const r of resourcesInRect(0,0,511,511))if((r.kind==='tree'||r.kind==='pine')&&(r.x+r.y)%3===0){ctx.beginPath();ctx.arc(r.x,r.y,1.3,0,Math.PI*2);ctx.fill();}
    return ground; }
export function pointerWorld(canvas: HTMLCanvasElement, pos: Position, x: number, y: number) {
    const box=canvas.getBoundingClientRect(),w=canvas.width/ART_DENSITY,h=canvas.height/ART_DENSITY;
    const ox=Math.round(w/2-pos.x*TILE),oy=Math.round(h/2-pos.y*TILE);
    return{x:((x-box.left)*w/box.width-ox)/TILE,y:((y-box.top)*h/box.height-oy)/TILE};
}
export function pickResource(point: {
    x: number;
    y: number;
}, s: WorldState, p: Position): Resource | undefined {
    if(floorLevel(p)>0)return undefined;
    return resourcesInRect(p.x-9,p.y-9,p.x+9,p.y+9).filter(r => !s.depleted[r.id] && Math.abs(r.x - p.x) < 9 && Math.abs(r.y - p.y) < 9 && point.x >= r.x - .6 && point.x <= r.x + 1.6 && point.y >= r.y - (r.kind === 'tree' || r.kind === 'pine' ? 2 : 0) && point.y <= r.y + 1.1).sort((a, b) => b.y - a.y)[0];
}
function roofGroup(s:WorldState,p:Position){return floorGroup(s.buildings,p.x,p.y,floorLevel(p));}
type SlimeDrawPosition={x:number;y:number;fromX:number;fromY:number;toX:number;toY:number;started:number;duration:number;tick:number;lastDraw:number;dead:boolean;phase:string};
function slimeDrawPosition(positions:Map<string,SlimeDrawPosition>,m:WorldState['mobs'][number],time:number,tick:number,phase:string,teleportDistance=3){
    let point=positions.get(m.id);
    const dead=m.hp<=0;
    if(!point||(point.phase!==phase&&phase!=='move')||point.dead!==dead||time<point.lastDraw||time-point.lastDraw>500||Math.hypot(m.x-point.toX,m.y-point.toY)>teleportDistance){
        point={x:m.x,y:m.y,fromX:m.x,fromY:m.y,toX:m.x,toY:m.y,started:time,duration:0,tick,lastDraw:time,dead,phase};positions.set(m.id,point);return point;
    }
    const progress=point.duration?Math.max(0,Math.min(1,(time-point.started)/point.duration)):1;
    point.x=point.fromX+(point.toX-point.fromX)*progress;point.y=point.fromY+(point.toY-point.fromY)*progress;
    if(m.x!==point.toX||m.y!==point.toY){
        point.fromX=point.x;point.fromY=point.y;point.toX=m.x;point.toY=m.y;point.started=time;point.duration=Math.max(90,Math.min(950,tick-point.tick));
    }
    point.tick=tick;point.lastDraw=time;point.phase=phase;return point;
}

const playerViews=new WeakMap<HTMLCanvasElement,{scope:string;positions:Map<string,SlimeDrawPosition>}>();
const slimeViews=new WeakMap<HTMLCanvasElement,{roomKey:string;created:number;poses:Map<string,{phase:string;started:number}>;positions:Map<string,SlimeDrawPosition>}>();

export function render(canvas: HTMLCanvasElement, s: WorldState, id: string, pos: Position, view: View, art: Atlas) {
    const w = Math.max(1, Math.floor(canvas.clientWidth / 2)), h = Math.max(1, Math.floor(canvas.clientHeight / 2));
    if (canvas.width !== w*ART_DENSITY)
        canvas.width = w*ART_DENSITY;
    if (canvas.height !== h*ART_DENSITY)
        canvas.height = h*ART_DENSITY;
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(ART_DENSITY,0,0,ART_DENSITY,0,0);
    ctx.imageSmoothingEnabled = false;
    const ox = Math.round(w / 2 - pos.x * TILE), oy = Math.round(h / 2 - pos.y * TILE), t = view.time;
    const minX = Math.floor(-ox / TILE) - 1, maxX = Math.ceil((w - ox) / TILE) + 1, minY = Math.floor(-oy / TILE) - 3, maxY = Math.ceil((h - oy) / TILE) + 4;
    const underground=sceneAt(pos.x)==='mine',level=floorLevel(pos),buildings=Object.values(s.buildings),groundOy=oy+floorLevel(pos)*TILE;
    const events=[...s.events.filter(e=>!(e.kind==='hit'&&e.commandId&&view.settledCommands?.has(e.commandId))),...(view.predictedEvents??[])];
    for(let y=minY;y<maxY;y++)for(let x=minX;x<maxX;x++){
        terrainTile(ctx,art,x,y,ox,groundOy,t);
        const terrain=terrainAt(x,y),px=x*TILE+ox,py=y*TILE+groundOy;
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
    if(!underground)drawLandscape(ctx,s,art,ox,groundOy,{minX,minY:minY-level,maxX,maxY});
    if(underground)for(let y=minY;y<maxY;y++)for(let x=minX;x<maxX;x++){
        if(terrainAt(x,y)==='cave-wall'&&terrainAt(x,y+1)==='cave-floor'){
            material(ctx,art['ground-cave-wall'],x,y,x*TILE+ox,y*TILE+oy+18,24,15);
            ctx.globalAlpha=.14;ctx.fillStyle='#556584';ctx.fillRect(x*TILE+ox,y*TILE+oy+32,24,2);ctx.globalAlpha=1;
        }
    }
    treeShadows(ctx,s,{...pos,level:0},art,ox,groundOy);
    const visible = (x: number, y: number) => x > minX - 4 && x < maxX + 4 && y > minY - 4 && y < maxY + 3;
    const sprite = (name: Sprite, x: number, y: number, width: number, height: number, alpha = 1, flip = false) => { ctx.save(); ctx.globalAlpha = alpha; const px = Math.round(x * TILE + ox), py = Math.round(y * TILE + oy); if (flip) {
        ctx.translate(px, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(art[name], -width / 2, py - height, width, height);
    }
    else
        ctx.drawImage(art[name], Math.round(px - width / 2), py - height, width, height); ctx.restore(); };
    const drawFloor=(b:Building,shift=0)=>{
        const inset=floorWallInsets(s.buildings,b.x,b.y,floorLevel(b));
        const x=b.x*TILE+ox,y=b.y*TILE+oy+shift;
        if(inset.left||inset.right||inset.top||inset.bottom){
            ctx.save();ctx.beginPath();ctx.rect(x+inset.left,y+inset.top,TILE-inset.left-inset.right,TILE-inset.top-inset.bottom);ctx.clip();
            material(ctx,art.floor,b.x,b.y,x,y);ctx.restore();
        }else material(ctx,art.floor,b.x,b.y,x,y);
    };
    const queueWall=(queue:{y:number;draw:()=>void}[],b:Building,shift=0,fade=true)=>{
        for(const part of connectedWallLayers(art,s.buildings,b)){
            const depth=b.y+part.depth+shift/TILE;
            queue.push({y:depth,draw:()=>{
                const left=b.x*TILE+part.x,right=left+part.width,top=b.y*TILE+shift+part.y,bottom=top+part.height;
                const occludes=fade&&depth>pos.y&&left<pos.x*TILE+7&&right>pos.x*TILE-7&&top<pos.y*TILE&&bottom>pos.y*TILE-32;
                ctx.save();ctx.globalAlpha=occludes?.42:1;drawWallLayer(ctx,part,b,ox,oy+shift);ctx.restore();
            }});
        }
    };
    const queueCrop=(queue:{y:number;draw:()=>void}[],plot:Plot,shift=0,highlight=false)=>{
        if(!plot.crop)return;
        const x=plot.x+CROP_SIZE.groundX,y=plot.y+CROP_SIZE.groundY;
        queue.push({y:y+shift/TILE,draw:()=>{
            const stage=cropStage(plot,t);
            ctx.drawImage(art[`crop-${plot.crop!}-${stage}`],Math.round(x*TILE+ox-CROP_SIZE.anchorX),Math.round(y*TILE+oy+shift-CROP_SIZE.anchorY),CROP_SIZE.width,CROP_SIZE.height);
            if(highlight&&stage===3&&Math.sin(t/600+plot.x)>.75){ctx.save();ctx.globalAlpha=.65;ctx.drawImage(art.spark,(plot.x+.75)*TILE+ox,(plot.y-.3)*TILE+oy+shift,5,5);ctx.restore();}
        }});
    };
    // Composite each lower storey before the next floor can cover it.
    // Terrain and lighting stay single-pass; ground props enter only storey zero.
    if(level>0){
        for(let lower=0;lower<level;lower++){
            const below:{y:number;draw:()=>void}[]=[],shift=(level-lower)*TILE;
            for(const b of buildings.filter(b=>floorLevel(b)===lower&&visible(b.x,b.y))){
                const px=b.x*TILE+ox,py=b.y*TILE+oy+shift;
                if(b.kind==='floor')drawFloor(b,shift);
                else if(b.kind==='roof'){
                    if(!atLevel(s.buildings,b.x,b.y,'floor',lower+1))below.push({y:b.y+.95+shift/TILE,draw:()=>material(ctx,art.roof,b.x,b.y,...roofRect(b.x,b.y,ox,oy+shift))});
                }else if(layer(b.kind)==='wall'||b.kind==='fence')queueWall(below,b,shift,false);
                else below.push({y:b.y+.9+shift/TILE,draw:()=>{const bed=b.kind==='bed',size=bed?40:b.kind==='stairs'?30:24,height=bed?24:size;ctx.drawImage(art[b.kind as Sprite],px+(24-size)/2,py+24-height,size,height);}});
            }
            if(lower===0){
                for(const r of resourcesInRect(minX-4,minY-level-4,maxX+4,maxY+3)){
                    if(!visible(r.x,r.y))continue;
                    if(s.depleted[r.id]){if(r.kind==='tree'||r.kind==='pine')sprite('stump',r.x+.5,r.y+1+level,14,12);continue;}
                    const tree=r.kind==='tree'||r.kind==='pine';
                    below.push({y:r.y+.8+level,draw:()=>sprite(resourceSprite(r),r.x+.5,r.y+1+level,tree?43:r.kind==='berry'?24:25,tree?58:r.kind==='berry'?21:24)});
                }
                for(const plot of Object.values(s.plots??{}))if(visible(plot.x,plot.y)){
                    ctx.save();ctx.globalAlpha*=soilOpacity(plot,t);material(ctx,art[plot.wetUntil>t?'soil-wet':'soil-dry'],plot.x,plot.y,plot.x*TILE+ox,plot.y*TILE+groundOy);ctx.restore();
                    queueCrop(below,plot,shift);
                }
                if(visible(SPAWN.x,SPAWN.y))below.push({y:SPAWN.y-1.4+level,draw:()=>ctx.drawImage(art[`fire${Math.floor(t/FIRE_FRAME_MS)%FIRE_FRAME_COUNT}`],Math.round(SPAWN.x*TILE+ox-FIRE_SIZE.anchorX),Math.round((SPAWN.y-1.4)*TILE+groundOy-FIRE_SIZE.anchorY),FIRE_SIZE.width,FIRE_SIZE.height)});
                if(visible(CAVE_ENTRANCE.x,CAVE_ENTRANCE.y))below.push({y:CAVE_ENTRANCE.y-1.6+level,draw:()=>{const img=art['cave-entrance'],width=168,height=Math.round(width*img.height/img.width);ctx.drawImage(img,CAVE_ENTRANCE.x*TILE+ox-width/2,CAVE_ENTRANCE.y*TILE+groundOy-height+12,width,height);}});
            }
            for(const p of Object.values(s.players))if(floorLevel(p)===lower&&t-p.seen<15000&&visible(p.x,p.y)){
                const work=p.workAction&&p.workStart!==undefined&&p.workUntil?{action:p.workAction,start:p.workStart,until:p.workUntil,face:p.swingFace??p.face}:null;
                const face=work&&t<work.until?work.face:heroFacing(p,p.face,t),frame=(work?workFrame(work,t):null)??heroFrame(p,face,(p.movingUntil??0)>s.tick,t,p.equipped??'axe');
                below.push({y:p.y+shift/TILE+(work?.action==='sleep'&&t<work.until ? .2 : 0),draw:()=>sprite(frame,p.x,p.y+shift/TILE+(HERO_SIZE.height-HERO_SIZE.anchorY)/TILE,HERO_SIZE.width,HERO_SIZE.height,1,face==='left')});
            }
            for(const m of s.mobs)if(floorLevel(m)===lower&&visible(m.x,m.y)){
                const frame=creatureFrame(m,t,(m.movingUntil??0)>s.tick);if(frame)below.push({y:m.y+shift/TILE,draw:()=>sprite(frame,m.x,m.y+shift/TILE+(SLIME_SIZE.height-SLIME_SIZE.anchorY)/TILE,SLIME_SIZE.width,SLIME_SIZE.height,1,(m.kind==='boar'||m.kind==='mushroom')&&creatureFacing(m,t)==='left')});
            }
            below.sort((a,b)=>a.y-b.y).forEach(d=>d.draw());
        }
        ctx.fillStyle='#fff0d01c';ctx.fillRect(0,0,w,h);
    }
    for(const b of buildings)if(b.kind==='floor'&&floorLevel(b)===level&&visible(b.x,b.y))drawFloor(b);
    const fireX = (SPAWN.x) * TILE + ox, fireY = (SPAWN.y - 1.4) * TILE + oy;
    const drawables: {
        y: number;
        draw: () => void;
    }[] = [];
    if(level===0&&!underground&&visible(SPAWN.x,SPAWN.y-1.4))drawables.push({y:SPAWN.y-1.4,draw:()=>{
        ctx.drawImage(art[`fire${Math.floor(t/FIRE_FRAME_MS)%FIRE_FRAME_COUNT}`],Math.round(fireX-FIRE_SIZE.anchorX),Math.round(fireY-FIRE_SIZE.anchorY),FIRE_SIZE.width,FIRE_SIZE.height);
    }});
    if(level===0)for (const r of resourcesInRect(minX-4,minY-4,maxX+4,maxY+3)) {
        if (!visible(r.x, r.y))
            continue;
        if (s.depleted[r.id]) {
            if (r.kind === 'tree' || r.kind === 'pine')
                sprite('stump', r.x + .5, r.y + 1, 14, 12);
            continue;
        }
        drawables.push({ y: r.y + .8, draw: () => { const tree = r.kind === 'tree' || r.kind === 'pine', near = tree && Math.abs(pos.x - r.x - .5) < 1.1 && pos.y < r.y + .8 && pos.y > r.y - 1.6; const recent = events.some(e => e.kind === 'hit' && t - e.time < 200 && Math.abs(e.x - r.x - .5) < .1 && Math.abs(e.y - r.y - .5) < .1); sprite(resourceSprite(r), r.x + .5 + (recent ? Math.sin(t * .06) * .06 : 0), r.y + 1, tree ? 43 : r.kind === 'berry' ? 24 : 25, tree ? 58 : r.kind === 'berry' ? 21 : 24, near ? .5 : 1); } });
    }
    for (const b of Object.values(s.buildings)) {
        if (!visible(b.x, b.y) || floorLevel(b)!==level || b.kind === 'floor' || b.kind === 'roof')
            continue;
        if(layer(b.kind)==='wall'||b.kind==='fence'){queueWall(drawables,b);continue;}
        drawables.push({ y: b.y + .9, draw: () => {
                const fade = b.y > pos.y - .3 && b.y < pos.y + 1.2 && Math.abs(b.x + .5 - pos.x) < 1.05;
                ctx.save();ctx.globalAlpha=fade?.42:1;
                const img=art[b.kind as Sprite],bed=b.kind==='bed',size=bed?40:b.kind==='stairs'?30:24,height=bed?24:size;ctx.drawImage(img,b.x*TILE+ox+(24-size)/2,b.y*TILE+oy+24-height,size,height);ctx.restore();
            } });
    }
    if(level===0)for(const plot of Object.values(s.plots??{})){if(!visible(plot.x,plot.y))continue;
        ctx.save();ctx.globalAlpha*=soilOpacity(plot,t);material(ctx,art[plot.wetUntil>t?'soil-wet':'soil-dry'],plot.x,plot.y,plot.x*TILE+ox,plot.y*TILE+oy);ctx.restore();
        queueCrop(drawables,plot,0,true);
    }
    if(level>0)for(const stair of buildings.filter(b=>b.kind==='stairs'&&floorLevel(b)===level-1)){if(visible(stair.x,stair.y))ctx.drawImage(art['stairs-down'],stair.x*TILE+ox,stair.y*TILE+oy,24,24);}
    if(level===0&&!underground&&visible(CAVE_ENTRANCE.x,CAVE_ENTRANCE.y))drawables.push({y:CAVE_ENTRANCE.y-1.6,draw:()=>{
        const img=art['cave-entrance'],width=168,height=Math.round(width*img.height/img.width);
        ctx.drawImage(img,Math.round(CAVE_ENTRANCE.x*TILE+ox-width/2),Math.round(CAVE_ENTRANCE.y*TILE+oy-height+12),width,height);
    }});
    if(level===0&&!underground)for(const [x,y,rotation]of[[278.5,317.5,Math.PI/2],[300.8,318.5,0],[300.8,220.5,Math.PI/2],[349,223,0]])if(visible(x,y))drawables.push({y:y+.3,draw:()=>{const px=x*TILE+ox,py=y*TILE+oy;ctx.drawImage(art.sign,px-10,py-24,20,25);ctx.save();ctx.translate(px,py-17);ctx.rotate(rotation);ctx.drawImage(art.ascend,-4,-4,8,8);ctx.restore();}});
    if(underground){
        for(const [x,y] of MINE_TORCHES)if(visible(x,y))drawables.push({y:y+1,draw:()=>ctx.drawImage(art.torch,x*TILE+ox+5,y*TILE+oy-10,14,27)});
        drawables.push({y:MINE.exit.y-1.5,draw:()=>{const img=art['mine-exit'],width=144,height=Math.round(width*img.height/img.width);ctx.drawImage(img,MINE.exit.x*TILE+ox-width/2,MINE.exit.y*TILE+oy-height+12,width,height);}});
    }
    let slimeView=slimeViews.get(canvas);
    const roomKey=view.roomKey??'';
    if(!slimeView||slimeView.roomKey!==roomKey||slimeView.created!==s.created){slimeView={roomKey,created:s.created,poses:new Map(),positions:new Map()};slimeViews.set(canvas,slimeView);}
    for(const original of s.mobs){
        if(level!==floorLevel(original)||sceneAt(original.x)!==sceneAt(pos.x)||!visible(original.x,original.y))continue;
        const anticipated=view.predictedEvents?.find(e=>e.targetId===original.id&&t-e.time<350),hitUntil=anticipated?anticipated.time+350:view.suppressedHits?.[original.id]===original.hitUntil?0:original.hitUntil;
        const m=hitUntil===original.hitUntil?original:{...original,hitUntil},stats=CREATURES[m.kind??'slime'];
        // Keep the last received movement state until a newer snapshot changes it.
        const moving=(m.movingUntil??0)>s.tick;
        const contact=m.windup||m.attackAt||(m.cooldown?m.cooldown-stats.cooldown:0),recovering=contact&&t>=contact&&t<contact+350;
        const phase=m.hp<=0?'death':t<m.hitUntil?'hurt':m.windup>t||recovering||(m.chargeUntil??0)>t?'attack':moving?'move':'idle';
        let pose=slimeView.poses.get(m.id);
        if(!pose||pose.phase!==phase||t<pose.started){pose={phase,started:t};slimeView.poses.set(m.id,pose);}
        const frame=creatureFrame(m,t,moving,t-pose.started);if(!frame)continue;
        const point=slimeDrawPosition(slimeView.positions,m,t,s.tick,phase,m.kind==='boar'?12:3);
        if(m.kind==='mushroom'&&m.windup>t&&m.attackX!==undefined&&m.attackY!==undefined){ctx.save();ctx.strokeStyle='#ddbd63b0';ctx.fillStyle='#e9d98925';ctx.beginPath();ctx.ellipse(m.attackX*TILE+ox,m.attackY*TILE+oy,stats.reach*TILE,stats.reach*TILE*.72,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore();}
        if(m.kind==='boar'&&m.windup>t&&m.attackX!==undefined&&m.attackY!==undefined){ctx.save();ctx.globalAlpha=.5;ctx.strokeStyle='#efce8c';ctx.setLineDash([3,4]);ctx.beginPath();ctx.moveTo(m.x*TILE+ox,m.y*TILE+oy);ctx.lineTo(m.attackX*TILE+ox,m.attackY*TILE+oy);ctx.stroke();ctx.restore();}
        drawables.push({y:point.y,draw:()=>{
            ctx.fillStyle='#48615730';ctx.fillRect(point.x*TILE+ox-8,point.y*TILE+oy-2,16,3);
            if(m.hp<=0)ctx.globalAlpha=Math.max(0,Math.min(1,(480-(t-m.deadUntil+90000))/120));
            ctx.save();ctx.translate(Math.round(point.x*TILE+ox),Math.round(point.y*TILE+oy));
            if((m.kind==='boar'||m.kind==='mushroom')&&creatureFacing(m,t)==='left')ctx.scale(-1,1);
            ctx.drawImage(art[frame],-SLIME_SIZE.anchorX,-SLIME_SIZE.anchorY,SLIME_SIZE.width,SLIME_SIZE.height);ctx.restore();ctx.globalAlpha=1;
            if(m.windup>t){ctx.globalAlpha=.45;ctx.drawImage(art.spark,point.x*TILE+ox-7,point.y*TILE+oy-29,14,14);ctx.globalAlpha=1;}
            if(m.hp>0&&(m.hp<stats.hp||distance(pos,m)<4)){ctx.fillStyle='#58724b';ctx.fillRect(point.x*TILE+ox-11,point.y*TILE+oy-34,22,3);ctx.fillStyle='#bbe685';ctx.fillRect(point.x*TILE+ox-10,point.y*TILE+oy-33,20*m.hp/stats.hp,1);}
        }});
    }
    let playersView=playerViews.get(canvas);const scope=`${view.roomKey??s.created}:${level}`;
    if(!playersView||playersView.scope!==scope){playersView={scope,positions:new Map()};playerViews.set(canvas,playersView);}
    for (const p of Object.values(s.players)) {
        if (t - p.seen > 15000 && p.id !== id)
            continue;
        if(floorLevel(p)!==level||sceneAt(p.x)!==sceneAt(pos.x))continue;
        const local=p.id===id,point=local?pos:slimeDrawPosition(playersView.positions,{...p,homeX:p.x,homeY:p.y,windup:0,cooldown:0,deadUntil:0},t,s.tick,'move',12);
        if (!visible(point.x, point.y))
            continue;
        const work=local?view.localWork:p.workAction&&p.workStart!==undefined&&p.workUntil?{action:p.workAction,start:p.workStart,until:p.workUntil,face:p.swingFace??p.face}:null;
        drawables.push({ y: point.y+(work?.action==='sleep'&&t<work.until ? .2 : 0), draw: () => {
                const moving=local?pos.moving:(p.movingUntil??0)>s.tick,swing=local?view.localSwing:undefined;
                const face=work&&t<work.until?work.face:heroFacing(p,local?pos.face:p.face,t,swing);
                const frame=(work?workFrame(work,t):null)??heroFrame(p,face,moving,t,local?view.tool:p.equipped??'axe',swing,local?view.motionElapsed:undefined);
                const trail=work&&t<work.until?null:toolTrailFrame(p,t,swing),px=Math.round(point.x*TILE+ox),py=Math.round(point.y*TILE+oy);
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
    if(view.tool==='build')drawBuildGrid(ctx,ox,oy,w,h);
    drawables.sort((a, b) => a.y - b.y).forEach(d => d.draw());
    const indoors=roofGroup(s,pos),roofs=buildings.filter(b=>b.kind==='roof'&&floorLevel(b)>=level),covers=buildings.filter(b=>b.kind==='floor'&&floorLevel(b)>level);
    const roofOpacity=roofVisibility(canvas,`${view.roomKey??s.created}:${id}:${sceneAt(pos.x)}:${level}`,[...roofs,...covers],indoors,t);
    const opacity=(b:Building)=>roofOpacity.get(`${b.x}:${b.y}${floorLevel(b)?':'+floorLevel(b):''}`)??1;
    for(let upper=level+1;upper<=MAX_LEVEL;upper++){
        const offset=(upper-level)*24;
        for(const floor of covers.filter(b=>floorLevel(b)===upper&&visible(b.x,b.y))){ctx.globalAlpha=Math.max(0,(opacity(floor)-.14)/.86);drawFloor(floor,-offset);}
        ctx.globalAlpha=1;
        for(const wall of buildings.filter(b=>floorLevel(b)===upper&&layer(b.kind)==='wall'&&visible(b.x,b.y)).sort((a,b)=>a.y-b.y)){
            const cover=atLevel(s.buildings,wall.x,wall.y,'floor',upper);ctx.globalAlpha=cover?Math.max(0,(opacity(cover)-.14)/.86):1;drawConnectedWall(ctx,art,s.buildings,wall,ox,oy-offset);
        }ctx.globalAlpha=1;
    }
    for(const b of roofs)if(visible(b.x,b.y)){
        const upper=floorLevel(b),offset=(upper-level)*24;ctx.globalAlpha=opacity(b);
        material(ctx,art.roof,b.x,b.y,...roofRect(b.x,b.y,ox,oy-offset));const [rx,ry]=roofRect(b.x,b.y,ox,oy-offset);
        if(!atLevel(s.buildings,b.x,b.y+1,'roof',upper))ctx.drawImage(art['wall-cap'],0,0,art['wall-cap'].width,art['wall-cap'].height/8,rx,ry+22,24,3);
        if(!atLevel(s.buildings,b.x,b.y-1,'roof',upper))ctx.drawImage(art['roof-ridge'],0,0,art['roof-ridge'].width,art['roof-ridge'].height/4,rx,ry,24,4);
        ctx.globalAlpha=1;
    }
    if(view.tool==='build'){
        const point=view.pointer??{x:pos.x+(pos.face==='right'?1:pos.face==='left'?-1:0),y:pos.y+(pos.face==='down'?1:pos.face==='up'?-1:0)};
        const player=s.players[id];if(player)drawBuildTarget(ctx,buildGuide(s,{...player,...pos},buildTarget(point,s,view.remove,level),view.part,view.remove),ox,oy);
        const x=point.x*TILE+ox,y=point.y*TILE+oy,working=view.localWork&&t<view.localWork.until;
        ctx.save();ctx.translate(Math.round(x),Math.round(y));if(working)ctx.rotate(Math.sin((t-view.localWork!.start)/50)*.35);ctx.drawImage(art.hammer,-3,-17,17,20);ctx.restore();
    }
    else if (view.pointer) {
        const target = pickResource(view.pointer, s, pos);
        if (target && distance(pos, { x: target.x + .5, y: target.y + .5 }) < 2.8) {
            ctx.strokeStyle = '#edf1bf';
            ctx.lineWidth = 1;
            ctx.strokeRect(target.x * TILE + ox + 2, target.y * TILE + oy + 3, 20, 17);
        }
    }
    for (const e of events) {
        if(floorLevel(e)!==level||sceneAt(e.x)!==sceneAt(pos.x))continue;
        const age = t - e.time;
        if (age < 0 || age > 1200)
            continue;
        const f = age / 1200;
        ctx.globalAlpha = 1 - f;
        const x = e.x * TILE + ox, y = e.y * TILE + oy - 20 - f * 18;
        if (e.kind === 'hit' || e.kind === 'hurt') {
            ctx.fillStyle = e.kind === 'hurt' ? '#efd1ac' : '#f6ecc3';
            ctx.font = 'bold 8px monospace';
            if (e.amount > 1&&!('predicted' in e&&e.predicted))
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
        else if(e.kind==='spore'){ctx.globalAlpha=(1-f)*.65;for(let i=0;i<8;i++){const a=i*Math.PI/4,r=8+f*34;ctx.drawImage(art.mushrooms,x+Math.cos(a)*r-3,y+20+Math.sin(a)*r*.65-3,7,7);}}
        else if(e.kind==='water'){ctx.globalAlpha=(1-f)*.7;for(let i=0;i<5;i++)ctx.drawImage(art['water-drop'],x-8+i*4,y+12+f*8-(i%2)*5,3,5);}
        else if (e.amount) {
            const type = e.kind==='harvest'?e.crop:e.kind==='eat'||e.kind==='sleep'?'heart':e.kind;
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

export function paintMap(c:HTMLCanvasElement,s:WorldState,id:string,art?:Atlas){
    const ctx=c.getContext('2d')!;c.width=c.height=512*ART_DENSITY;ctx.setTransform(ART_DENSITY,0,0,ART_DENSITY,0,0);ctx.imageSmoothingEnabled=false;
    const local=s.players[id],mine=local&&sceneAt(local.x)==='mine',scale=mine?512/MINE.size:1,origin=mine?MINE.x:0;
    if(mine){for(let y=0;y<MINE.size;y++)for(let x=0;x<MINE.size;x++){ctx.fillStyle=COLORS[terrainAt(x+MINE.x,y)];ctx.fillRect(x*scale,y*scale,Math.ceil(scale),Math.ceil(scale));}}
    else ctx.drawImage(worldMap(),0,0);
    if(!mine){
        for(const b of Object.values(s.buildings)){ctx.fillStyle=b.kind==='floor'?'#d19667':'#946749';ctx.fillRect(b.x,b.y,1.5,1.5);}
        if(art){
            for(const landmark of NATURAL_LANDMARKS){const point=landmarkCenter(landmark);ctx.drawImage(art[landmark.id],point.x-13,point.y-15,26,22);}
            ctx.drawImage(art['cave-entrance'],CAVE_ENTRANCE.x-17,CAVE_ENTRANCE.y-17,34,22);
        }
    }
    const labels:{x:number;y:number;w:number;h:number}[]=[];ctx.font='11px sans-serif';
    for(const l of mine?[{...MINE.exit,name:'出口'}]:LANDMARKS){
        const x=(l.x-origin)*scale,y=l.y*scale,width=ctx.measureText(l.name).width+10;
        const left=Math.max(6,Math.min(506-width,x+8));let top=y-8;
        for(const shift of [0,17,-17,34,-34]){const candidate=y-8+shift;if(!labels.some(r=>left<r.x+r.w&&left+width>r.x&&candidate<r.y+r.h&&candidate+16>r.y)){top=candidate;break;}}
        top=Math.max(5,Math.min(491,top));labels.push({x:left,y:top,w:width,h:16});
        ctx.fillStyle='#486847';ctx.fillRect(x-2,y-2,4,4);ctx.fillStyle='#f7eedccc';ctx.fillRect(left,top,width,16);ctx.fillStyle='#426148';ctx.fillText(l.name,left+5,top+12);
    }
    ctx.fillStyle='#f7eedcd9';ctx.fillRect(477,10,25,35);ctx.fillStyle='#567653';ctx.font='10px sans-serif';ctx.fillText('北',484,21);ctx.beginPath();ctx.moveTo(489,26);ctx.lineTo(485,38);ctx.lineTo(493,38);ctx.closePath();ctx.fill();
    for(const p of Object.values(s.players)){if((sceneAt(p.x)==='mine')!==Boolean(mine))continue;ctx.fillStyle=p.id===id?'#fff6c0':'#e8a36b';ctx.beginPath();ctx.arc((p.x-origin)*scale,p.y*scale,4,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#627454';ctx.stroke();}
}

export { regionAt, WORLD_SIZE };
