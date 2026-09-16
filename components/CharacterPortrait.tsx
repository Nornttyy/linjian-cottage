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
        let active=true,draw=()=>{};
        const canvas=ref.current!;
        const observer=new ResizeObserver(()=>draw());observer.observe(canvas);
        const redraw=()=>draw();
        loadArt().then(art=>{if(active){
            const sprite=dressedHero(art,frameKey('idle',direction,0),appearance);setFailed(false);
            draw=()=>{
                const width=Math.max(1,Math.round(canvas.clientWidth*window.devicePixelRatio)),height=Math.max(1,Math.round(canvas.clientHeight*window.devicePixelRatio));
                if(canvas.width!==width)canvas.width=width;if(canvas.height!==height)canvas.height=height;
                const ctx=canvas.getContext('2d')!;ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,width,height);
                // Sample the original sprite once at the displayed resolution.
                ctx.drawImage(sprite,28,24,72,80,0,0,width,height);
            };draw();
        }}).catch(()=>{if(active)setFailed(true);});
        window.addEventListener('resize',redraw);
        return()=>{active=false;observer.disconnect();window.removeEventListener('resize',redraw);};
    },[appearance,direction]);
    return <span className="character-portrait" aria-hidden="true"><canvas ref={ref} width={108} height={120}/>{(failed||!ready)&&<small>{failed?'外观加载失败':'正在加载外观…'}</small>}</span>;
}
