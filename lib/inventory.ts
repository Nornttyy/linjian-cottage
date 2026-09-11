import type {Inventory} from './simulation';
export const HOTBAR_SIZE=9;
export const BACKPACK_SIZE=27;
export type ItemKey='axe'|'pick'|'sword'|'hammer'|'hoe'|'water'|'rod'|keyof Inventory;
export type ItemSlot=ItemKey|null;
export const ITEMS:Record<ItemKey,{name:string;icon:string;kind:'tool'|'resource'}>={
    axe:{name:'斧头',icon:'axe',kind:'tool'},pick:{name:'镐',icon:'pick',kind:'tool'},sword:{name:'剑',icon:'sword',kind:'tool'},
    hammer:{name:'建造锤',icon:'hammer',kind:'tool'},hoe:{name:'锄头',icon:'hoe',kind:'tool'},water:{name:'洒水壶',icon:'water',kind:'tool'},rod:{name:'鱼竿',icon:'rod',kind:'tool'},
    wood:{name:'木材',icon:'wood',kind:'resource'},stone:{name:'石头',icon:'stone',kind:'resource'},copper:{name:'铜矿',icon:'copper',kind:'resource'},essence:{name:'精华',icon:'essence',kind:'resource'},
    carrotSeed:{name:'胡萝卜种子',icon:'carrot-seed',kind:'resource'},tomatoSeed:{name:'番茄种子',icon:'tomato-seed',kind:'resource'},wheatSeed:{name:'小麦种子',icon:'wheat-seed',kind:'resource'},
    fish:{name:'鲜鱼',icon:'fish',kind:'resource'},meal:{name:'熟食',icon:'meal',kind:'resource'},
    carrot:{name:'胡萝卜',icon:'carrot',kind:'resource'},tomato:{name:'番茄',icon:'tomato',kind:'resource'},wheat:{name:'小麦',icon:'wheat',kind:'resource'},
};
const tools:ItemKey[]=['axe','pick','sword','hammer','hoe','water','rod'];
const resources=(Object.keys(ITEMS) as ItemKey[]).filter(item=>ITEMS[item].kind==='resource');
export function defaultSlots(inventory?:Inventory):ItemSlot[]{
    const slots:ItemSlot[]=Array.from({length:HOTBAR_SIZE+BACKPACK_SIZE},(_,i)=>tools[i]??null);
    return restoreSlots(slots,inventory);
}
export function restoreSlots(value:unknown,inventory?:Inventory):ItemSlot[]{
    if(!Array.isArray(value)||value.length!==HOTBAR_SIZE+BACKPACK_SIZE)return defaultSlots(inventory);
    const seen=new Set<ItemKey>();
    const slots:ItemSlot[]=Array.from(value,item=>{
        if(typeof item!=='string'||!Object.hasOwn(ITEMS,item)||seen.has(item as ItemKey))return null;
        const key=item as ItemKey;
        if(ITEMS[key].kind==='resource'&&inventory&&itemCount(key,inventory)<=0)return null;
        seen.add(key);return key;
    });
    // Saved empty hotkeys stay empty. Missing tools and newly owned resources go in the backpack.
    for(const item of [...tools,...resources.filter(item=>itemCount(item,inventory)>0)])if(!seen.has(item)){
        const empty=slots.indexOf(null,HOTBAR_SIZE);
        if(empty>=0){slots[empty]=item;seen.add(item);}
    }
    return slots;
}
export function reconcileSlots(slots:ItemSlot[],inventory:Inventory):ItemSlot[]{
    const next=restoreSlots(slots,inventory);
    return slots.length===next.length&&slots.every((item,i)=>item===next[i])?slots:next;
}
export function itemCount(item:ItemSlot,inventory?:Inventory){
    return item&&ITEMS[item].kind==='resource'?inventory?.[item as keyof Inventory]??0:item?1:0;
}
export function visibleItem(item:ItemSlot,inventory?:Inventory):ItemSlot{return itemCount(item,inventory)>0?item:null;}
export function itemDescription(item:ItemSlot){
    if(!item)return '';
    return item==='rod'?'鱼竿 · 岸边点击水面钓鱼':item==='fish'?'鲜鱼 · 营火旁烹饪':item==='meal'?'熟食 · 回复36生命':item==='essence'?'精华 · 回复30生命':item==='hammer'?'建造锤':item==='carrot'?'胡萝卜 · 回复12生命':item==='tomato'?'番茄 · 回复10生命':ITEMS[item].name;
}
export function swapSlots(slots:ItemSlot[],from:number,to:number):ItemSlot[]{
    if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<0||from>=slots.length||to>=slots.length||from===to)return slots;
    const next=[...slots];[next[from],next[to]]=[next[to],next[from]];return next;
}
export function quickTransfer(slots:ItemSlot[],from:number){
    const start=from<HOTBAR_SIZE?HOTBAR_SIZE:0,end=from<HOTBAR_SIZE?slots.length:HOTBAR_SIZE;
    for(let i=start;i<end;i++)if(slots[i]===null)return swapSlots(slots,from,i);
    return slots;
}
