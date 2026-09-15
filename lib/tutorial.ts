import type {ClientState} from './client';
import {atLevel,floorLevel,type Building} from './structures';
import {sceneAt} from './world';
import {DISH_IDS,ODD_DISH_IDS} from './cooking';
import type {Session} from './client';
export const TUTORIAL_STEPS=['wood','stone','floor','plant','water','fire','fish','meal','walls','roof','bed','harvest','variety','provisions','mine','ore','combat','return','lantern','sign','rest'] as const;
export type TutorialStep=typeof TUTORIAL_STEPS[number];
export type TutorialProgress={version:2;done:TutorialStep[];dismissed:boolean;home?:{x:number;y:number};restAfter?:number};
export function savedSession(raw:string|null):Session|null{
    try{const value=JSON.parse(raw||'null');return value&&typeof value==='object'&&typeof value.room==='string'&&/^[A-Z0-9]{8}$/.test(value.room)&&typeof value.token==='string'&&value.token.trim().length>0&&value.token.length<=100&&typeof value.playerId==='string'&&/^[A-Za-z0-9_-]{1,64}$/.test(value.playerId)?{room:value.room,token:value.token,playerId:value.playerId,...(value.local===true?{local:true as const}:{})}:null;}catch{return null;}
}
export const tutorialKey=(session:Pick<Session,'room'|'playerId'>)=>`linjian-tutorial:${session.room}:${session.playerId}`;

export function readTutorial(raw:string|null):TutorialProgress{
    let value;try{value=JSON.parse(raw||'null');}catch{}
    const progress:TutorialProgress={version:2,done:[],dismissed:value?.dismissed===true};
    if(value?.version!==2)return progress;
    progress.done=TUTORIAL_STEPS.filter(step=>Array.isArray(value.done)&&value.done.includes(step));
    if(Number.isFinite(value.home?.x)&&Number.isFinite(value.home?.y)&&value.home.x>0&&value.home.x<510&&value.home.y>0&&value.home.y<510)progress.home={x:Math.floor(value.home.x),y:Math.floor(value.home.y)};
    if(Number.isSafeInteger(value.restAfter)&&value.restAfter>=0)progress.restAfter=value.restAfter;
    return progress;
}
export const LESSONS:Record<TutorialStep,{chapter:string;title:string;goal:number;hint:string}>={
    wood:{chapter:'一 · 安家',title:'备好第一批木材',goal:24,hint:'用斧头砍营地周围的树；木桩还能再砍。先备 24 木材，用来铺地板和生火。'},
    stone:{chapter:'一 · 安家',title:'敲出炉石',goal:10,hint:'营地东侧有石头。用镐采集 10 石材，留给篝火和窗墙。'},
    floor:{chapter:'一 · 安家',title:'定下小屋地基',goal:9,hint:'背包里把建造锤放进快捷栏。选地板，在营火外铺满一块 3×3 的空地；需要 18 木材。'},
    plant:{chapter:'一 · 安家',title:'种下三垄晚饭',goal:3,hint:'小屋外用锄头开三格地，选胡萝卜种子种下。种子已经在背包里。'},
    water:{chapter:'一 · 安家',title:'让菜园开始生长',goal:3,hint:'给刚种的三格菜浇水。胡萝卜约 90 秒成熟；趁它生长，去准备炉火和鱼。'},
    fire:{chapter:'一 · 安家',title:'为小屋生一炉火',goal:1,hint:'在小屋十格以内建一堆篝火，需要 8 木材、4 石材。它能照明，也能做饭。'},
    fish:{chapter:'二 · 一日三餐',title:'为晚饭钓两次鱼',goal:2,hint:'带钓竿去营地东侧风息河。点近岸水面抛竿，咬钩后提竿，按住/松开控制收线。'},
    meal:{chapter:'二 · 一日三餐',title:'做出第一道热菜',goal:1,hint:'回篝火旁按 F 打开厨房，放入刚钓的鱼选择烤制。成功后会记下这次做法。'},
    walls:{chapter:'二 · 一日三餐',title:'围出能进出的小屋',goal:8,hint:'沿 3×3 地基外围放 7 面木墙或窗墙，边的中间留一扇门；中心留空。约需 25 木材。'},
    roof:{chapter:'二 · 一日三餐',title:'把屋顶盖好',goal:9,hint:'给这块 3×3 地基盖满屋顶，需要 18 木材。走进屋里时，屋顶会自动隐去。'},
    bed:{chapter:'二 · 一日三餐',title:'留一个安心歇脚的地方',goal:1,hint:'在小屋中心放一张床，需要 12 木材。门口不要堵住，回来后可以休息。'},
    harvest:{chapter:'二 · 一日三餐',title:'收回自己种的晚饭',goal:9,hint:'回菜园点击成熟的作物，收获 9 份。若还没成熟，检查是否浇过水；小麦和番茄更慢。'},
    variety:{chapter:'二 · 一日三餐',title:'给餐桌换一道菜',goal:2,hint:'用收成尝试另一道正常料理，例如烤时蔬。材料可以自由搭配；奇怪杂物不算这次晚饭。'},
    provisions:{chapter:'三 · 带着手艺出发',title:'打包两份路餐',goal:2,hint:'背包里留两份正常料理再出发。受伤后吃饭能恢复生命；不必为了教程浪费食物。'},
    mine:{chapter:'三 · 带着手艺出发',title:'沿小径进入铜石矿洞',goal:1,hint:'打开地图标记矿洞，沿东北方向的小径去洞口。带上镐、剑和路餐。'},
    ore:{chapter:'三 · 带着手艺出发',title:'挖出照亮归途的铜',goal:3,hint:'在矿洞里采集至少 3 铜。留一块做提灯，剩下的可以用来布置小屋。'},
    combat:{chapter:'三 · 带着手艺出发',title:'清开一段危险的小路',goal:1,hint:'用剑击败一只挡路的怪物。看到它蓄力就躲开，受伤时退到安全处吃路餐。'},
    return:{chapter:'四 · 归家的灯',title:'带着收获回家',goal:1,hint:'从矿洞出口回到地表，再回到自己搭的小屋。'},
    lantern:{chapter:'四 · 归家的灯',title:'给门口挂一盏灯',goal:1,hint:'在小屋五格以内建提灯，需要 2 木材、1 铜。灯留在原地，夜里也能找到家。'},
    sign:{chapter:'四 · 归家的灯',title:'给小屋留下名字',goal:1,hint:'在小屋旁建路牌，点击写下小屋的名字。需要 2 木材。'},
    rest:{chapter:'四 · 归家的灯',title:'在自己的床上歇一晚',goal:1,hint:'走到小屋中心的床边，点击床或按 F。歇好这一觉，安家旅程就完成了。'},
};
export type TutorialTracker={progress:TutorialProgress;counts:Partial<Record<TutorialStep,number>>};
function homeScore(buildings:Record<string,Building>,owner:string,home:{x:number;y:number}){
    const own=(x:number,y:number,part:'floor'|'wall'|'roof'|'bed')=>{const b=atLevel(buildings,x,y,part,0);return b?.ownerId===owner?b:undefined;};
    let floor=0,walls=0,roof=0,door=false;
    for(let dy=0;dy<3;dy++)for(let dx=0;dx<3;dx++){
        const x=home.x+dx,y=home.y+dy;if(own(x,y,'floor'))floor++;if(own(x,y,'roof'))roof++;
        if(dx===1&&dy===1)continue;const b=own(x,y,'wall');if(b&&['wall','window','door'].includes(b.kind))walls++;
        if(b?.kind==='door'&&((dx===1)!==(dy===1)))door=true;
    }
    const bed=own(home.x+1,home.y+1,'bed')?.kind==='bed';
    return{floor,walls:door?walls:Math.min(7,walls),roof,bed:Number(bed)};
}
export function startTutorial(state:ClientState,progress=readTutorial(null)):TutorialTracker{
    const tracker={progress,counts:{}};observeTutorial(tracker,state);return tracker;
}
export function observeTutorial(tracker:TutorialTracker,state:ClientState):TutorialProgress{
    const p=state.session?state.world.players[state.session.playerId]:undefined;if(!p||!state.connected||tracker.progress.dismissed)return tracker.progress;
    const previous=tracker.progress,next={...previous,done:[...previous.done]},j=p.journal??{},buildings=state.world.buildings;
    const own=Object.values(buildings).filter(b=>b.ownerId===p.id&&floorLevel(b)===0);
    let home=next.home,best=home?homeScore(buildings,p.id,home):{floor:0,walls:0,roof:0,bed:0};
    if(best.floor<9){const seen=new Set<string>();for(const b of own.filter(b=>b.kind==='floor'))for(let dy=0;dy<3;dy++)for(let dx=0;dx<3;dx++){
        const candidate={x:b.x-dx,y:b.y-dy},key=`${candidate.x}:${candidate.y}`;if(seen.has(key))continue;seen.add(key);
        const score=homeScore(buildings,p.id,candidate);if(score.floor>best.floor){home=candidate;best=score;}
    }}
    if(home&&best.floor===9)next.home=home;
    const nearby=(b:Building,r:number)=>home&&Math.hypot(b.x-home.x-1,b.y-home.y-1)<=r;
    const normal=(id:string)=>!(ODD_DISH_IDS as readonly string[]).includes(id);
    const cooked=(j.cooked??[]).filter(normal),watered=(j.watered??[]).filter(key=>j.planted?.includes(key));
    const counts:Partial<Record<TutorialStep,number>>={wood:Math.max(p.woodGathered??0,p.inventory.wood),stone:Math.max(j.stone??0,p.inventory.stone),floor:best.floor,
        plant:j.planted?.length??0,water:watered.length,fire:Number(own.some(b=>b.kind==='campfire'&&nearby(b,10))),fish:j.fish??0,meal:cooked.length,walls:best.walls,roof:best.roof,bed:best.bed,
        harvest:j.harvest??0,variety:cooked.length,provisions:DISH_IDS.filter(normal).reduce((n,id)=>n+(p.inventory[id]??0),0),mine:Number(j.mine),ore:j.mineCopper??0,combat:p.kills??0,
        return:Number(!!j.mine&&sceneAt(p.x)==='surface'&&floorLevel(p)===0&&!!home&&Math.hypot(p.x-home.x-1.5,p.y-home.y-1.5)<3),
        lantern:Number(own.some(b=>b.kind==='lantern'&&nearby(b,5))),sign:Number(own.some(b=>b.kind==='sign'&&b.text?.trim()&&nearby(b,5))),rest:0};
    for(const step of TUTORIAL_STEPS){if(step==='rest')continue;if((counts[step]??0)>=LESSONS[step].goal&&!next.done.includes(step))next.done.push(step);}
    // The last rest must happen after returning and furnishing the finished home.
    if(TUTORIAL_STEPS.filter(step=>step!=='rest').every(step=>next.done.includes(step))&&next.restAfter===undefined)next.restAfter=j.slept??0;
    if(next.restAfter!==undefined&&(j.slept??0)>next.restAfter&&counts.return&&best.bed&&best.floor===9&&best.walls===8&&best.roof===9){counts.rest=1;if(!next.done.includes('rest'))next.done.push('rest');}
    next.done=TUTORIAL_STEPS.filter(step=>next.done.includes(step));tracker.counts=counts;
    if(JSON.stringify(next)!==JSON.stringify(previous))tracker.progress=next;return tracker.progress;
}
