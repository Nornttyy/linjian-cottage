import {COLORS,terrainAt,sceneAt,MINE,CAVE_ENTRANCE,SPAWN} from './world';
import {worldMap,type Position} from './renderer';
import {floorLevel} from './structures';
import {NATURAL_LANDMARKS,landmarkCenter} from './map-features';
import type {WorldState} from './simulation';
import type {Atlas,Sprite} from './art';

export const MINIMAP_SIZE=160,MINIMAP_RANGE=80;
export function minimapProjection(pos:{x:number;y:number},target:{x:number;y:number},range=MINIMAP_RANGE){
    const dx=(target.x-pos.x)*MINIMAP_SIZE/range,dy=(target.y-pos.y)*MINIMAP_SIZE/range;
    const factor=Math.max(1,Math.abs(dx)/70,Math.abs(dy)/70);
    return{x:80+dx/factor,y:80+dy/factor,edge:factor>1,angle:Math.atan2(dy,dx)};
}
let caveMap:HTMLCanvasElement|undefined;
function mineMap(){
    if(caveMap)return caveMap;
    caveMap=document.createElement('canvas');caveMap.width=caveMap.height=MINE.size;const ctx=caveMap.getContext('2d')!;
    for(let y=0;y<MINE.size;y++)for(let x=0;x<MINE.size;x++){ctx.fillStyle=COLORS[terrainAt(MINE.x+x,MINE.y+y)];ctx.fillRect(x,y,1,1);}
    return caveMap;
}
function arrow(ctx:CanvasRenderingContext2D,x:number,y:number,angle:number,color:string,size=5){
    ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.fillStyle=color;ctx.strokeStyle='#526244';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(size,0);ctx.lineTo(-size,size*.7);ctx.lineTo(-size*.5,0);ctx.lineTo(-size,-size*.7);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
}
export function paintMinimap(canvas:HTMLCanvasElement,state:WorldState,id:string,pos:Position,art?:Atlas){
    if(canvas.width!==MINIMAP_SIZE*2)canvas.width=MINIMAP_SIZE*2;if(canvas.height!==MINIMAP_SIZE*2)canvas.height=MINIMAP_SIZE*2;
    const ctx=canvas.getContext('2d')!;ctx.setTransform(2,0,0,2,0,0);ctx.imageSmoothingEnabled=false;
    const mine=sceneAt(pos.x)==='mine',level=floorLevel(pos),scale=MINIMAP_SIZE/MINIMAP_RANGE;
    ctx.fillStyle=mine?'#c6bfcd':'#d9e0c4';ctx.fillRect(0,0,MINIMAP_SIZE,MINIMAP_SIZE);
    const origin=mine?MINE:{x:0,y:0},terrain=mine?mineMap():worldMap();
    ctx.drawImage(terrain,80+(origin.x-pos.x)*scale,80+(origin.y-pos.y)*scale,terrain.width*scale,terrain.height*scale);
    ctx.save();ctx.beginPath();ctx.rect(0,0,MINIMAP_SIZE,MINIMAP_SIZE);ctx.clip();
    // Building footprints come from the live world, on the floor being viewed.
    const buildings=Object.values(state.buildings).filter(b=>sceneAt(b.x)===sceneAt(pos.x)&&floorLevel(b)===level);
    for(const layer of ['floor','solid'])for(const b of buildings){
        if((b.kind==='floor')!==(layer==='floor'))continue;
        const x=80+(b.x-pos.x)*scale,y=80+(b.y-pos.y)*scale;
        if(x< -scale||y< -scale||x>160||y>160)continue;
        ctx.fillStyle=b.kind==='floor'?'#e7c286':b.kind==='roof'?'#c98957':b.kind==='door'?'#f4deb0':b.kind==='stairs'?'#fff1c8':'#936643';ctx.fillRect(x,y,scale,scale);
    }
    if(!mine&&level===0)for(const plot of Object.values(state.plots??{})){
        const x=80+(plot.x-pos.x)*scale,y=80+(plot.y-pos.y)*scale;
        if(x<0||y<0||x>160||y>160)continue;ctx.fillStyle=plot.crop?'#769757':'#b58d64';ctx.fillRect(x,y,scale,scale);
    }
    const marker=(target:{x:number;y:number},sprite:Sprite,size=12)=>{
        const point=minimapProjection(pos,target);if(point.edge||!art?.[sprite])return;
        ctx.drawImage(art[sprite],point.x-size/2,point.y-size/2,size,size);
    };
    if(!mine){marker(SPAWN,'fire0');for(const area of NATURAL_LANDMARKS)marker(landmarkCenter(area),area.id,14);}
    const destination=mine?MINE.exit:CAVE_ENTRANCE,guide=minimapProjection(pos,destination);
    if(guide.edge)arrow(ctx,guide.x,guide.y,guide.angle,'#f1c97c',4);
    else marker(destination,mine?'mine-exit':'cave-entrance',15);
    ctx.font='9px "PingFang SC","Microsoft YaHei",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
    const label=mine?'出口':'矿洞',lx=Math.max(17,Math.min(143,guide.x)),ly=guide.y>135?guide.y-11:guide.y+11;
    ctx.fillStyle='#f5ecd1eb';ctx.fillRect(lx-12,ly-6,24,12);ctx.fillStyle='#765733';ctx.fillText(label,lx,ly);
    for(const p of Object.values(state.players)){
        if(p.id===id||state.tick-p.seen>15000||sceneAt(p.x)!==sceneAt(pos.x)||floorLevel(p)!==level)continue;
        const point=minimapProjection(pos,p),color=['#72b9cf','#ce90a1','#ac91cc','#94b869'][p.color%4]??'#72b9cf';
        if(point.edge)arrow(ctx,point.x,point.y,point.angle,color,3.5);
        else{ctx.fillStyle=color;ctx.strokeStyle='#fff3d2';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(point.x,point.y,3,0,Math.PI*2);ctx.fill();ctx.stroke();}
    }
    arrow(ctx,80,80,{right:0,down:Math.PI/2,left:Math.PI,up:-Math.PI/2}[pos.face],'#fff8d9',5);
    ctx.restore();
}
