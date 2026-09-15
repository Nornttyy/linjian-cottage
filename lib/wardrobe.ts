import {normalizeAppearance,type Appearance} from './appearance';
import {terrainAt} from './world';
export const WEARABLES=[
    {id:'mushroom-cap',name:'伞菇兜帽',slot:'headwear',row:0,hint:'青叶林的倒木旁',effect:'孢子伤害 −25%',x:220.5,y:288.5},
    {id:'moon-antlers',name:'月鹿枝角',slot:'headwear',row:1,hint:'日光石环',effect:'食物恢复生命 +15%',x:367.5,y:408.5},
    {id:'copper-goggles',name:'铜鸦护目镜',slot:'headwear',row:2,hint:'矿洞深处的旧矿道',effect:'每处铜矿多得 1 铜',x:685.5,y:22.5},
    {id:'leaf-crown',name:'苔叶花冠',slot:'headwear',row:3,hint:'收获 12 份作物',effect:'每次收获多得 1 份',harvest:12},
    {id:'mushroom-cloak',name:'伞菇雨披',slot:'outfit',row:0,hint:'青叶林的倒木旁',effect:'孢子伤害 −35%',x:220.5,y:288.5},
    {id:'moth-cloak',name:'萤蛾披风',slot:'outfit',row:1,hint:'萤草甸',effect:'闪避体力消耗 22',x:156.5,y:425.5},
    {id:'snow-cloak',name:'白松斗篷',slot:'outfit',row:2,hint:'霜石垒',effect:'受到伤害 −15%',x:377.5,y:94.5},
    {id:'moss-cloak',name:'苔叶行装',slot:'outfit',row:3,hint:'古木林心',effect:'每棵树多得 2 木材',x:143.5,y:209.5},
    {id:'river-swim',name:'溪蓝泳装',slot:'outfit',row:-1,hint:'找到月鹿枝角和白松斗篷，钓获 6 次后到河桥东岸领取',effect:'可游泳 · 水中速度 2.6',x:290.5,y:322.5,fish:6,requires:['moon-antlers','snow-cloak']},
    {id:'coral-swim',name:'珊瑚泳装',slot:'outfit',row:-1,hint:'找到铜鸦护目镜和萤蛾披风，钓获 12 次后到河桥东岸领取',effect:'可游泳 · 水中速度 3.0',x:290.5,y:322.5,fish:12,requires:['copper-goggles','moth-cloak']},
] as const;
export type WearableId=typeof WEARABLES[number]['id'];
export type WardrobeOwner={wardrobe?:string[]};
export function hasWearable(owner:WardrobeOwner,id:string){return WEARABLES.some(item=>item.id===id&&owner.wardrobe?.includes(id));}
export function unlockWearable(owner:WardrobeOwner,id:string){if(!WEARABLES.some(item=>item.id===id)||hasWearable(owner,id))return false;owner.wardrobe=[...(owner.wardrobe??[]),id];return true;}
export function equippedAppearance(value:unknown,owner:WardrobeOwner):Appearance{
    const a=normalizeAppearance(value);for(const slot of ['headwear','outfit'] as const)if(a[slot]&&!hasWearable(owner,a[slot]!))delete a[slot];return a;
}
export function safeAppearance(value:unknown,owner:WardrobeOwner&{appearance?:Appearance;x?:number;y?:number}):Appearance{
    const next=equippedAppearance(value,owner);
    if(owner.x!==undefined&&owner.y!==undefined&&terrainAt(Math.floor(owner.x),Math.floor(owner.y))==='water'&&canSwim(owner))next.outfit=owner.appearance?.outfit;
    return next;
}
export const WARDROBE_ART_FILES=['wardrobe-heads-v3.png','wardrobe-cloaks-v2.png','swim-body-v1.png','swim-male-shirt-v1.png'] as const;
export function wearing(owner:WardrobeOwner&{appearance?:Appearance},id:string){return hasWearable(owner,id)&&(owner.appearance?.headwear===id||owner.appearance?.outfit===id);}
export function canSwim(owner:WardrobeOwner&{appearance?:Appearance}){return wearing(owner,'river-swim')||wearing(owner,'coral-swim');}
export function wearableReady(owner:WardrobeOwner&{journal?:{fish?:number}},id:string){const item=WEARABLES.find(item=>item.id===id);return !!item&&(!('requires'in item)||item.requires.every(key=>hasWearable(owner,key)))&&(!('fish'in item)||(owner.journal?.fish??0)>=item.fish);}
