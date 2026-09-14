export const CLOTHING_COLORS={
    original:{name:'原色',color:'#20becb'},rose:{name:'蔷薇',color:'#cd7186'},lavender:{name:'紫藤',color:'#9c87c9'},
    moss:{name:'苔绿',color:'#789855'},gold:{name:'麦黄',color:'#d6ae55'},cream:{name:'米白',color:'#e5d9bb'},
    rust:{name:'陶红',color:'#b8704d'},blue:{name:'湖蓝',color:'#5e9bc7'},slate:{name:'灰蓝',color:'#657383'},
} as const;
export type ClothingColor=keyof typeof CLOTHING_COLORS;
export type Appearance={body:'male'|'female';shirt:ClothingColor;pants:ClothingColor};
export const DEFAULT_APPEARANCE:Appearance={body:'male',shirt:'original',pants:'original'};
export function normalizeAppearance(value:unknown):Appearance{
    const a=value&&typeof value==='object'?value as Partial<Appearance>:{};
    const color=(key:unknown):ClothingColor=>typeof key==='string'&&Object.hasOwn(CLOTHING_COLORS,key)?key as ClothingColor:'original';
    return {body:a.body==='female'?'female':'male',shirt:color(a.shirt),pants:color(a.pants)};
}
export function appearanceKey(value:unknown){const a=normalizeAppearance(value);return `${a.body}:${a.shirt}:${a.pants}`;}
