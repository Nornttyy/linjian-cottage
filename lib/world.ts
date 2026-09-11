import {NATURAL_LANDMARKS,landmarkCenter,authoredLandAt,authoredTrailAt} from './map-features';
export const WORLD_SIZE = 512;
export const SPAWN = { x: 256.5, y: 320.5 };
export const CAVE_ENTRANCE = { x: 350.5, y: 215.5 };
export const MINE = { x: 640, y: 0, size: 96, spawn: {x:688.5,y:83.5}, exit: {x:688.5,y:90.5} };
export const sceneAt = (x:number) => x >= MINE.x ? 'mine' : 'surface';
export type Terrain = 'grass' | 'forest' | 'water' | 'sand' | 'rock' | 'snow' | 'marsh' | 'path' | 'cave-floor' | 'cave-wall';
const caveRooms = [[48,80,12,11],[46,60,15,12],[25,42,13,11],[64,37,17,12],[44,18,12,9]];
const cavePassages = [[48,80,46,60,4],[46,60,25,42,3],[46,60,64,37,4],[25,42,44,18,3],[64,37,44,18,3]];
export function caveFloor(x:number,y:number) {
    x-=MINE.x;
    if(x<2||y<2||x>=94||y>=94)return false;
    if(caveRooms.some(([cx,cy,rx,ry])=>((x-cx)/rx)**2+((y-cy)/ry)**2<1))return true;
    return cavePassages.some(([ax,ay,bx,by,r])=>{const d=(bx-ax)**2+(by-ay)**2,t=Math.max(0,Math.min(1,((x-ax)*(bx-ax)+(y-ay)*(by-ay))/d));return Math.hypot(x-ax-t*(bx-ax),y-ay-t*(by-ay))<r;});
}
export const MINE_TORCHES = [[681,82],[696,80],[676,62],[697,55],[656,42],[705,39],[677,19],[692,20]];
export type ResourceKind = 'tree' | 'pine' | 'stone' | 'copper' | 'berry';
export type Resource = {
    id: string;
    x: number;
    y: number;
    kind: ResourceKind;
};
export const COLORS: Record<Terrain, string> = { grass: '#a4c975', forest: '#659a68', water: '#51bfd2', sand: '#e4cc95', rock: '#b3b3a0', snow: '#e8eee2', marsh: '#8eb582', path: '#d9b779', 'cave-floor':'#ada2b6', 'cave-wall':'#77758e' };
export const LANDMARKS = [
    { x: 256, y: 320, name: '林间营地' }, { x: 217, y: 287, name: '青叶林' },
    { x: 283, y: 328, name: '风息河' }, { ...CAVE_ENTRANCE, name: '铜石矿洞' },
    { x: 160, y: 414, name: '薄雾湿地' }, { x: 326, y: 84, name: '白松雪岭' },
    ...NATURAL_LANDMARKS.map(landmark=>({...landmarkCenter(landmark),name:landmark.name})),
];
const riverPoints = [{ x: 224, y: 0 }, { x: 210, y: 100 }, { x: 272, y: 228 }, { x: 283, y: 328 }, { x: 310, y: 410 }, { x: 290, y: 512 }];
function riverX(y: number) { for (let i = 1; i < riverPoints.length; i++) {
    const a = riverPoints[i - 1], b = riverPoints[i];
    if (y <= b.y)
        return a.x + (b.x - a.x) * (y - a.y) / (b.y - a.y);
} return 290; }
// Frozen terrain sampler for the legacy resource layout. Never use the visual plan here.
function legacyTerrainAt(x: number, y: number): Terrain {
    if(sceneAt(x)==='mine')return caveFloor(x,y)?'cave-floor':'cave-wall';
    if (x < 0 || y < 0 || x >= WORLD_SIZE || y >= WORLD_SIZE)
        return 'water';
    const river = Math.abs(x - riverX(y));
    if (river < 5 && !(y >= 317 && y <= 320))
        return 'water';
    if (river < 7 && !(y >= 316 && y <= 321))
        return 'sand';
    if ((y >= 318 && y <= 320 && x > 213 && x < 301) || (x >= 298 && x <= 300 && y > 220 && y < 320)||(y>=220&&y<=222&&x>=299&&x<=350)||(x>=349&&x<=351&&y>=215&&y<=222))
        return 'path';
    if (y < 120 && x > 270)
        return 'snow';
    if (x > 315 && y < 256)
        return 'rock';
    if (x < 209 && y > 365)
        return 'marsh';
    if (x > 233 && x < 276 && y > 297 && y < 344)
        return 'grass';
    if ((x < 240 && y < 355) || (x > 275 && y > 345) || y < 285)
        return 'forest';
    return 'grass';
}
export function terrainAt(x:number,y:number):Terrain {
    const legacy=legacyTerrainAt(x,y);
    // Water collision, shoreline, bridge span and the entire mine stay byte-compatible.
    if(legacy==='water'||legacy==='sand'||legacy==='cave-floor'||legacy==='cave-wall')return legacy;
    if(y>=318&&y<=320&&x>213&&x<301)return 'path';
    if(x>=349&&x<=351&&y>=215&&y<=222)return 'path';
    const ground=authoredLandAt(x,y);
    // Existing resource cells keep their vegetation/mineral ground, never become fake clear trail.
    return authoredTrailAt(x,y)&&!RESOURCE_MAP.has(Math.floor(x)+':'+Math.floor(y))?'path':ground;
}
export function regionAt(x: number, y: number) { const t = terrainAt(x, y); return ({ grass: '林间草甸', forest: '青叶林', water: '风息河', sand: '风息河岸', rock: '铜石矿区', snow: '白松雪岭', marsh: '薄雾湿地', path: '林间小径', 'cave-floor':'铜石矿洞', 'cave-wall':'铜石矿洞' })[t]; }
export const RESOURCES: Resource[] = [];
// Permanent, authored grove patterns; every room uses the same positions.
const grovePattern = [[0, 0], [3, 1], [1, 4], [5, 5], [7, 2], [9, 6], [4, 9], [10, 10], [0, 8]];
for (let gy = 12; gy < 502; gy += 19)
    for (let gx = 12; gx < 502; gx += 23) {
        for (const [ox, oy] of grovePattern) {
            const x = gx + ox, y = gy + oy, t = legacyTerrainAt(x, y);
            if (Math.hypot(x-CAVE_ENTRANCE.x,y-CAVE_ENTRANCE.y)<7 || (Math.abs(x - SPAWN.x) < 22 && Math.abs(y - SPAWN.y) < 23) || t === 'path' || t === 'water' || t === 'sand')
                continue;
            const kind: ResourceKind = t === 'rock' ? 'copper' : t === 'snow' ? 'pine' : t === 'forest' ? 'tree' : t === 'marsh' ? 'berry' : 'stone';
            if (t === 'grass' && (ox + oy) % 3 !== 0)
                continue;
            RESOURCES.push({ id: x + ':' + y, x, y, kind });
        }
    }
for (const [dx, dy, kind] of [[-9, -5, 'tree'], [-11, -3, 'tree'], [-8, 5, 'tree'], [-12, 7, 'pine'], [9, -4, 'stone'], [11, -3, 'stone'], [8, 6, 'berry'], [-5, -9, 'tree'], [6, -9, 'stone'], [14, 4, 'copper'],
    [-14,-9,'tree'],[-12,-9,'tree'],[-10,-8,'tree'],[-14,-6,'pine'],[-11,-5,'tree'],
    [-14,5,'tree'],[-12,4,'tree'],[-13,9,'pine'],[-10,8,'tree'],[-7,8,'tree'],
    [12,-8,'tree'],[14,-7,'tree'],[13,-5,'tree'],[16,-9,'pine'],
    [14,10,'tree'],[16,9,'pine'],[18,12,'tree'],[12,12,'tree']] as [
    number,
    number,
    ResourceKind
][]) {
    const x = Math.floor(SPAWN.x) + dx, y = Math.floor(SPAWN.y) + dy;
    RESOURCES.push({ id: x + ':' + y, x, y, kind });
}
for(const [x,y] of [[40,77],[55,75],[39,69],[55,64],[36,60],[22,46],[28,35],[17,40],[60,44],[72,36],[65,29],[37,19],[50,14],[50,24],[45,53],[62,42]]){
    const wx=MINE.x+x;
    if(caveFloor(wx,y))RESOURCES.push({id:wx+':'+y,x:wx,y,kind:(x+y)%3?'copper':'stone'});
}
export const RESOURCE_MAP = new Map(RESOURCES.map(r => [r.id, r]));
export function resourceAt(x: number, y: number) { return RESOURCE_MAP.get(Math.floor(x) + ':' + Math.floor(y)); }

const resourceBuckets=new Map<string,Resource[]>();
for(const resource of RESOURCES){const key=Math.floor(resource.x/16)+':'+Math.floor(resource.y/16);let bucket=resourceBuckets.get(key);if(!bucket)resourceBuckets.set(key,bucket=[]);bucket.push(resource);}
const resourceOrder=new Map(RESOURCES.map((r,i)=>[r,i]));
export function resourcesInRect(x0:number,y0:number,x1:number,y1:number){const found:Resource[]=[];
 for(let cy=Math.floor(y0/16);cy<=Math.floor(y1/16);cy++)for(let cx=Math.floor(x0/16);cx<=Math.floor(x1/16);cx++)for(const r of resourceBuckets.get(cx+':'+cy)??[])if(r.x>=x0&&r.x<=x1&&r.y>=y0&&r.y<=y1)found.push(r);
 return found.sort((a,b)=>resourceOrder.get(a)!-resourceOrder.get(b)!);
}
