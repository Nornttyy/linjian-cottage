"use client";
import {useEffect,useRef} from 'react';
import {loadArt,paintIcon} from '@/lib/art';
export default function Icon({name,size=28}:{name:string;size?:number}){
    const ref=useRef<HTMLCanvasElement>(null);
    useEffect(()=>{let active=true;loadArt().then(art=>{if(active&&ref.current)paintIcon(ref.current.getContext('2d')!,name,art,32);});return()=>{active=false;};},[name]);
    return <canvas className="item-icon" ref={ref} width={32} height={32} style={{width:size,height:size}} aria-hidden="true"/>;
}
