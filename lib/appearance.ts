export const CLOTHING_COLORS={
    original:{name:'原色',color:'#20becb'},rose:{name:'蔷薇',color:'#cd7186'},lavender:{name:'紫藤',color:'#9c87c9'},
    moss:{name:'苔绿',color:'#789855'},gold:{name:'麦黄',color:'#d6ae55'},cream:{name:'米白',color:'#e5d9bb'},
    rust:{name:'陶红',color:'#b8704d'},blue:{name:'湖蓝',color:'#5e9bc7'},slate:{name:'灰蓝',color:'#657383'},
} as const;
export type ClothingColor=keyof typeof CLOTHING_COLORS|`#${string}`;
export const DYE_PARTS={hair:'头发',skin:'肤色',eyes:'眼睛',shirt:'上衣',pants:'下装',shoes:'鞋袜',trim:'身体装饰',outfitColor:'外装主色',outfitTrim:'外装花纹',headwearColor:'头饰主色'} as const;
export type DyePart=keyof typeof DYE_PARTS;
export type Appearance={body:'male'|'female';shirt:ClothingColor;pants:ClothingColor;hair?:ClothingColor;skin?:ClothingColor;eyes?:ClothingColor;shoes?:ClothingColor;trim?:ClothingColor;outfitColor?:ClothingColor;outfitTrim?:ClothingColor;headwearColor?:ClothingColor;headwear?:string;outfit?:string};
export const DEFAULT_APPEARANCE:Appearance={body:'male',shirt:'original',pants:'original'};
export function normalizeAppearance(value:unknown):Appearance{
    const a=value&&typeof value==='object'?value as Partial<Appearance>:{};
    const color=(key:unknown):ClothingColor=>typeof key==='string'&&(Object.hasOwn(CLOTHING_COLORS,key)||/^#[a-f0-9]{6}$/i.test(key))?key.toLowerCase() as ClothingColor:'original';
    const result:Appearance={body:a.body==='female'?'female':'male',shirt:color(a.shirt),pants:color(a.pants)};
    for(const part of ['hair','skin','eyes','shoes','trim','outfitColor','outfitTrim','headwearColor'] as const)if(color(a[part])!=='original')result[part]=color(a[part]);
    if(typeof a.headwear==='string'&&['mushroom-cap','moon-antlers','copper-goggles','leaf-crown'].includes(a.headwear))result.headwear=a.headwear;
    if(typeof a.outfit==='string'&&['mushroom-cloak','moth-cloak','snow-cloak','moss-cloak','river-swim','coral-swim'].includes(a.outfit))result.outfit=a.outfit;
    return result;
}
export function colorHex(value:ClothingColor|undefined,fallback='#20becb'):string{return value?.startsWith('#')?value:CLOTHING_COLORS[value as keyof typeof CLOTHING_COLORS]?.color??fallback;}
export function colorName(value:ClothingColor|undefined){return value?.startsWith('#')?'自选色':CLOTHING_COLORS[value as keyof typeof CLOTHING_COLORS]?.name??'原色';}
export function appearanceKey(value:unknown){const a=normalizeAppearance(value);return JSON.stringify(a);}
