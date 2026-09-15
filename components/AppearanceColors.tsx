"use client";
import {CLOTHING_COLORS,DYE_PARTS,colorHex,colorName,type Appearance,type ClothingColor,type DyePart} from '@/lib/appearance';
export default function AppearanceColors({value,onChange}:{value:Appearance;onChange:(a:Appearance)=>void}){
    return <div className="appearance-colors">{(Object.entries(DYE_PARTS) as [DyePart,string][]).filter(([part])=>part==='headwearColor'?!!value.headwear:part==='outfitColor'||part==='outfitTrim'?!!value.outfit&&!value.outfit.endsWith('-swim'):part!=='shoes'||!value.outfit?.endsWith('-swim')).map(([part,label])=><fieldset key={part}>
        <legend>{label} · {colorName(value[part])}</legend><div className="clothing-swatches">
            {Object.entries(CLOTHING_COLORS).map(([key,color])=><button type="button" key={key} className="clothing-swatch" title={color.name} aria-label={label+'颜色：'+color.name} aria-pressed={(value[part]??'original')===key} style={{backgroundColor:key==='original'&&part==='pants'?'#43a8df':color.color}} onClick={()=>onChange({...value,[part]:key as ClothingColor})}>{(value[part]??'original')===key?'✓':''}</button>)}
            <label className="custom-color" title="自选颜色"><span>自选</span><input type="color" aria-label={label+'自选颜色'} value={colorHex(value[part])} onChange={event=>onChange({...value,[part]:event.target.value as ClothingColor})}/></label>
        </div>
    </fieldset>)}</div>;
}
