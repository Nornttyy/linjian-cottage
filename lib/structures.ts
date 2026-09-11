export type Part='floor'|'wall'|'window'|'door'|'roof'|'stairs'|'planter'|'fence'|'lantern'|'sign'|'bed';
export type Building={id:string;x:number;y:number;kind:Part;open?:boolean;level?:number;text?:string};
export const MAX_LEVEL=2;
export const floorLevel=(value:{level?:number})=>Math.max(0,Math.min(MAX_LEVEL,value.level??0));
export const layer=(part:Part)=>part==='floor'?'floor':part==='roof'?'roof':['wall','window','door'].includes(part)?'wall':'fixture';
// Ground-floor keys stay byte-for-byte compatible with saved homes.
export const buildingKey=(x:number,y:number,part:Part,level=0)=>`${x}:${y}:${layer(part)}${level?':'+level:''}`;
export const atLevel=(buildings:Readonly<Record<string,Building>>,x:number,y:number,part:Part,level=0)=>buildings[buildingKey(x,y,part,level)];
export const PART_NAMES:Record<Part,string>={floor:'地板',wall:'木墙',window:'窗墙',door:'木门',roof:'屋顶',stairs:'楼梯',planter:'花盆',fence:'栅栏',lantern:'提灯',sign:'路牌',bed:'床'};
export const COSTS:Record<Part,Partial<Record<'wood'|'stone'|'copper',number>>>={floor:{wood:2},wall:{wood:3},window:{wood:3,stone:1},door:{wood:4},roof:{wood:2},stairs:{wood:20,stone:4},planter:{wood:3,stone:2},fence:{wood:2},lantern:{wood:2,copper:1},sign:{wood:2},bed:{wood:12}};
export function wallLinks(buildings:Readonly<Record<string,Building>>,x:number,y:number,level=0){
    const has=(a:number,b:number)=>!!atLevel(buildings,a,b,'wall',level)||atLevel(buildings,a,b,'fence',level)?.kind==='fence';
    return{north:has(x,y-1),east:has(x+1,y),south:has(x,y+1),west:has(x-1,y)};
}
export function wallRects(buildings:Readonly<Record<string,Building>>,x:number,y:number,level=0):number[][]{
    const links=wallLinks(buildings,x,y,level),b=atLevel(buildings,x,y,'wall',level);
    const vertical=(links.north||links.south)&&!links.east&&!links.west;
    if(b?.kind==='door'&&b.open)return vertical?[[9,0,6,4],[9,20,6,4]]:[[0,9,4,6],[20,9,4,6]];
    if(!links.north&&!links.south)return[[0,9,24,6]];
    const rects=[[9,9,6,6]];
    if(links.north)rects.push([9,0,6,9]);if(links.south)rects.push([9,15,6,9]);
    if(links.west)rects.push([0,9,9,6]);if(links.east)rects.push([15,9,9,6]);
    return rects;
}
export function wallOccupies(buildings:Readonly<Record<string,Building>>,x:number,y:number,level=0){
    const tx=Math.floor(x),ty=Math.floor(y),wall=atLevel(buildings,tx,ty,'wall',level),fixture=atLevel(buildings,tx,ty,'fence',level);
    if(!wall&&fixture?.kind!=='fence')return false;
    const px=(x-tx)*24,py=(y-ty)*24;
    return wallRects(buildings,tx,ty,level).some(([rx,ry,w,h])=>px>=rx&&px<rx+w&&py>=ry&&py<ry+h);
}
export function floorGroup(buildings:Readonly<Record<string,Building>>,x:number,y:number,level=0){
    const visited=new Set<string>(),todo=[[Math.floor(x),Math.floor(y)]];
    for(let i=0;i<todo.length&&visited.size<4096;i++){
        const [cx,cy]=todo[i],key=`${cx}:${cy}`;
        if(visited.has(key)||!atLevel(buildings,cx,cy,'floor',level))continue;
        visited.add(key);
        for(const [nx,ny]of[[cx-1,cy],[cx+1,cy],[cx,cy-1],[cx,cy+1]])if(!visited.has(`${nx}:${ny}`))todo.push([nx,ny]);
    }
    return visited;
}
export function canReachGround(buildings:Readonly<Record<string,Building>>,x:number,y:number,level:number):boolean{
    if(level===0)return true;
    const group=floorGroup(buildings,x,y,level);
    return Object.values(buildings).some(stair=>stair.kind==='stairs'&&floorLevel(stair)===level-1&&group.has(`${stair.x}:${stair.y}`)&&canReachGround(buildings,stair.x+.5,stair.y+.5,level-1));
}

export const SIGN_TEXT_LIMIT=240;
export function normalizeSignText(text:string){
    return text.replace(/\r\n?/g,'\n').replace(/\t/g,' ').replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g,'');
}
