"use client";
import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {loadArt,frameKey,type Direction} from '@/lib/art';
import {subscribeAssets,assetsReady,serverAssetsReady} from '@/lib/asset-loading';
import {dressedHero} from '@/lib/hero-appearance';
import {DEFAULT_APPEARANCE,type Appearance} from '@/lib/appearance';
export default function CharacterPortrait({appearance=DEFAULT_APPEARANCE,direction='down'}:{appearance?:Appearance;direction?:Direction}){
    const ready=useSyncExternalStore(subscribeAssets,assetsReady,serverAssetsReady);
    const ref=useRef<HTMLCanvasElement>(null),[failed,setFailed]=useState(false);
    useEffect(()=>{
        let active=true;
        loadArt().then(art=>{if(active&&ref.current){const ctx=ref.current.getContext('2d')!;setFailed(false);ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,108,120);ctx.drawImage(dressedHero(art,frameKey('idle',direction,0),appearance),28,24,72,80,0,0,108,120);}}).catch(()=>{if(active)setFailed(true);});
        return()=>{active=false;};
    },[appearance,direction]);
    return <span className="character-portrait" aria-hidden="true"><canvas ref={ref} width={108} height={120}/>{(failed||!ready)&&<small>{failed?'外观加载失败':'正在加载外观…'}</small>}</span>;
}
