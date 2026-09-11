"use client";
import {useEffect,useRef} from 'react';
import {ART_DENSITY,loadArt,paintIcon} from '@/lib/art';
export default function Icon({name,size=28}:{name:string;size?:number}){
    const ref=useRef<HTMLCanvasElement>(null);
    useEffect(()=>{let active=true;loadArt().then(art=>{if(active&&ref.current){const ctx=ref.current.getContext('2d')!;ctx.setTransform(ART_DENSITY,0,0,ART_DENSITY,0,0);paintIcon(ctx,name,art,32);}});return()=>{active=false;};},[name]);
    return <canvas className="item-icon" ref={ref} width={32*ART_DENSITY} height={32*ART_DENSITY} style={{width:size,height:size}} aria-hidden="true"/>;
}
