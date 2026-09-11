import type {Atlas,Sprite} from './art';
import {NATURAL_LANDMARKS,MEADOW_CLEARINGS} from './map-features';
import {terrainAt,sceneAt,resourceAt,type Resource} from './world';
import {atLevel} from './structures';
import type {WorldState} from './simulation';

export function resourceSprite(resource:Resource):Sprite{
    if(sceneAt(resource.x)==='mine')return resource.kind;
    const ground=terrainAt(resource.x,resource.y);
    if(resource.kind==='tree')return resource.y>345&&resource.x>275?'region-maple':resource.x<220&&resource.y<290?'region-birch':'region-oak';
    if(resource.kind==='pine'&&ground==='snow')return 'region-snowpine';
    if(resource.kind==='berry')return 'region-berry';
    if(resource.kind==='stone')return 'region-stone';
    return resource.kind;
}

export function landmarkClear(state:WorldState,area:typeof NATURAL_LANDMARKS[number]){
    for(const b of Object.values(state.buildings))if(b.x>=area.x-1&&b.x<area.x+area.width+1&&b.y>=area.y-1&&b.y<area.y+area.height+1)return false;
    for(const p of Object.values(state.plots??{}))if(p.x>=area.x-1&&p.x<area.x+area.width+1&&p.y>=area.y-1&&p.y<area.y+area.height+1)return false;
    return true;
}

// These sparse flower beds are authored around the existing open meadows.
const flowerOffsets=[[-.66,-.18],[-.6,-.05],[-.48,.02],[.57,-.29],[.64,-.12],[.48,.48],[.59,.51],[-.28,.59]];
const flowerBeds=MEADOW_CLEARINGS.flatMap((m,region)=>flowerOffsets.map(([dx,dy],i)=>({x:Math.floor(m.x+dx*m.rx),y:Math.floor(m.y+dy*m.ry),sprite:(region+i)%3===0?'flowers-pink' as const:'flowers-white' as const})));
export function drawLandscape(ctx:CanvasRenderingContext2D,state:WorldState,art:Atlas,ox:number,oy:number,bounds:{minX:number;minY:number;maxX:number;maxY:number}){
    const visible=(x:number,y:number,margin=1)=>x>bounds.minX-margin&&x<bounds.maxX+margin&&y>bounds.minY-margin&&y<bounds.maxY+margin;
    for(const flower of flowerBeds){
        if(!visible(flower.x,flower.y)||!['grass','forest','marsh'].includes(terrainAt(flower.x,flower.y))||resourceAt(flower.x,flower.y)||state.plots?.[`${flower.x}:${flower.y}`]||atLevel(state.buildings,flower.x,flower.y,'floor')||atLevel(state.buildings,flower.x,flower.y,'fence')||atLevel(state.buildings,flower.x,flower.y,'wall'))continue;
        ctx.drawImage(art[flower.sprite],flower.x*24+ox+2,flower.y*24+oy+9,20,14);
    }
    for(const area of NATURAL_LANDMARKS)if(visible(area.x,area.y,8)&&landmarkClear(state,area))ctx.drawImage(art[area.id],area.x*24+ox,area.y*24+oy,area.width*24,area.height*24);
}
