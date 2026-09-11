export const ART_FILES = [
    'surfaces-final.png','objects-final.png','icons-final.png','hero-walk-v2.png','hero-walk.png','hero-motion.png',
    'hero-axe-v3.png','hero-pick-v3.png','hero-sword-v3.png','slime.png','cave-entrance.png','hero-hurt-directions.png',
    'campfire-v2.png','campfire-flames-24.png','tool-trails.png','homestead-textures-v2.png','farm-growth.png','homestead-items.png',
    'bat.png','boar.png','mushroom.png','hero-hammer.png','hero-hoe.png','hero-water.png','hero-plant.png','mine-exit.png',
    'boar-directions.png','mushroom-directions.png','activity-items.png','hero-harvest.png','hero-pickup.png','hero-eat.png',
    'hero-fish.png','hero-cook.png','hero-sleep.png','hero-roll.png','bed-horizontal.png',
    'landscape-terrain-v3.png','landscape-props-v3.png','landscape-landmarks-v3.png'
] as const;
export type AssetLoading = {attempt:number;loaded:number;total:number;phase:'idle'|'images'|'atlas'|'ready'|'error';error:string};
const initial:AssetLoading={attempt:0,loaded:0,total:new Set(ART_FILES).size,phase:'idle',error:''};
let snapshot=initial,completed=new Set<string>();
const listeners=new Set<()=>void>();
function publish(value:AssetLoading){snapshot=value;for(const listener of listeners)listener();}
export const subscribeAssets=(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener);};};
export const getAssetLoading=()=>snapshot;
export const assetsReady=()=>snapshot.phase==='ready';
export const serverAssetsReady=()=>false;
export function beginAssets(){completed=new Set();publish({...initial,attempt:snapshot.attempt+1,phase:'images'});return snapshot.attempt;}
export function loadedAsset(attempt:number,src:string){
    if(attempt!==snapshot.attempt||snapshot.phase==='error')return;
    const name=src.slice(src.lastIndexOf('/')+1);
    if(!ART_FILES.some(file=>file===name))throw Error('素材清单不匹配');
    if(completed.has(name))return;completed.add(name);
    publish({...snapshot,loaded:completed.size,phase:completed.size===snapshot.total?'atlas':'images'});
}
export function finishAssets(attempt:number){
    if(attempt!==snapshot.attempt)return;
    if(snapshot.loaded!==snapshot.total)throw Error('素材准备不完整');
    publish({...snapshot,phase:'ready',error:''});
}
export function failAssets(attempt:number,error:unknown){
    if(attempt!==snapshot.attempt)return;
    publish({...snapshot,phase:'error',error:error instanceof Error?error.message:'素材加载失败'});
}
