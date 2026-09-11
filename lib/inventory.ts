import type {Inventory} from './simulation';
export const HOTBAR_SIZE=9;
export const BACKPACK_SIZE=27;
export type ItemKey='axe'|'pick'|'sword'|'hammer'|'hoe'|'water'|keyof Inventory;
export type ItemSlot=ItemKey|null;
export const ITEMS:Record<ItemKey,{name:string;icon:string;kind:'tool'|'resource'}>={
    axe:{name:'斧头',icon:'axe',kind:'tool'},pick:{name:'镐',icon:'pick',kind:'tool'},sword:{name:'剑',icon:'sword',kind:'tool'},
    hammer:{name:'建造锤',icon:'hammer',kind:'tool'},hoe:{name:'锄头',icon:'hoe',kind:'tool'},water:{name:'洒水壶',icon:'water',kind:'tool'},
    wood:{name:'木材',icon:'wood',kind:'resource'},stone:{name:'石头',icon:'stone',kind:'resource'},copper:{name:'铜矿',icon:'copper',kind:'resource'},essence:{name:'精华',icon:'essence',kind:'resource'},
    carrotSeed:{name:'胡萝卜种子',icon:'carrot-seed',kind:'resource'},tomatoSeed:{name:'番茄种子',icon:'tomato-seed',kind:'resource'},wheatSeed:{name:'小麦种子',icon:'wheat-seed',kind:'resource'},
    carrot:{name:'胡萝卜',icon:'carrot',kind:'resource'},tomato:{name:'番茄',icon:'tomato',kind:'resource'},wheat:{name:'小麦',icon:'wheat',kind:'resource'},
};
const defaults:ItemKey[]=['axe','pick','sword','hammer','hoe','water','carrotSeed','tomatoSeed','essence','wheatSeed','wood','stone','copper','carrot','tomato','wheat'];
export function defaultSlots():ItemSlot[]{return Array.from({length:HOTBAR_SIZE+BACKPACK_SIZE},(_,i)=>defaults[i]??null);}
export function restoreSlots(value:unknown):ItemSlot[]{
    if(!Array.isArray(value)||value.length!==HOTBAR_SIZE+BACKPACK_SIZE)return defaultSlots();
    const seen=new Set<ItemKey>();
    const slots=value.map(item=>{
        if(typeof item!=='string'||!Object.hasOwn(ITEMS,item)||seen.has(item as ItemKey))return null;
        seen.add(item as ItemKey);return item as ItemKey;
    });
    for(const item of defaults)if(!seen.has(item)){const empty=slots.indexOf(null);if(empty>=0)slots[empty]=item;}
    return slots;
}
export function itemCount(item:ItemSlot,inventory?:Inventory){
    return item&&ITEMS[item].kind==='resource'?inventory?.[item as keyof Inventory]??0:item?1:0;
}
export function visibleItem(item:ItemSlot,inventory?:Inventory):ItemSlot{return itemCount(item,inventory)>0?item:null;}
export function itemDescription(item:ItemSlot){
    if(!item)return '';
    return item==='essence'?'精华 · 回复30生命':item==='hammer'?'建造锤':item==='carrot'?'胡萝卜 · 回复12生命':item==='tomato'?'番茄 · 回复10生命':ITEMS[item].name;
}
export function swapSlots(slots:ItemSlot[],from:number,to:number):ItemSlot[]{
    if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<0||from>=slots.length||to>=slots.length||from===to)return slots;
    const next=[...slots];[next[from],next[to]]=[next[to],next[from]];return next;
}
export function quickTransfer(slots:ItemSlot[],from:number,inventory?:Inventory){
    const start=from<HOTBAR_SIZE?HOTBAR_SIZE:0,end=from<HOTBAR_SIZE?slots.length:HOTBAR_SIZE;
    for(let i=start;i<end;i++)if(!visibleItem(slots[i],inventory))return swapSlots(slots,from,i);
    return slots;
}
