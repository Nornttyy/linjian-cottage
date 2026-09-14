"use client";
import {useEffect,useRef,useState,useSyncExternalStore,type ReactNode} from 'react';
import {loadArt} from '@/lib/art';
import {artFilename} from '@/lib/art-sources';
import {getAssetLoading,getServerAssetLoading,subscribeAssets} from '@/lib/asset-loading';

export default function SiteEntry({children}:{children:ReactNode}){
    const loading=useSyncExternalStore(subscribeAssets,getAssetLoading,getServerAssetLoading);
    const [entered,setEntered]=useState(false),[attempt,setAttempt]=useState(0),[landscapeReady,setLandscapeReady]=useState(false),[landscapeError,setLandscapeError]=useState(false);
    const landscape=useRef<HTMLImageElement>(null);
    const failed=loading.phase==='error'||landscapeError,ready=loading.phase==='ready'&&landscapeReady&&!failed;
    useEffect(()=>{
        const shell=document.getElementById('site-bootstrap');if(shell)shell.hidden=true;
        window.dispatchEvent(new Event('linjian:booted'));
        // A server-rendered or cached image can finish before React attaches
        // onLoad. Read its decoded dimensions as well to avoid a stuck gate.
        const image=landscape.current;if(image?.complete){if(image.naturalWidth>0)setLandscapeReady(true);else if(image.currentSrc)setLandscapeError(true);}
        // Keep the shared preparation alive if the player chooses the menu.
        // Character previews and game entry reuse this exact promise and atlas.
        void loadArt().catch(()=>{});
    },[attempt]);
    useEffect(()=>{if(!ready||entered)return;const timer=setTimeout(()=>setEntered(true),260);return()=>clearTimeout(timer);},[ready,entered]);
    if(entered)return children;
    const percent=Math.floor(loading.loaded/Math.max(1,loading.total)*100);
    const status=failed?'小路暂时有些不通，重新试一次吧。':ready?'灯已经亮了，欢迎回家。':loading.phase==='atlas'||loading.phase==='ready'?'行囊已备齐，正在点亮小屋…':'正在装好旅人的行囊…';
    return <section className={'site-entry'+(ready?' entry-ready':'')} aria-label="正在准备林间小筑" aria-busy={!ready&&!failed}>
        {/* eslint-disable-next-line @next/next/no-img-element -- Prime the same unmodified game asset URL used by the menu background. */}
        <img ref={landscape} className="entry-preload" key={attempt} src={'./art/'+artFilename('main-menu-v1.png')} alt="" aria-hidden="true" onLoad={()=>setLandscapeReady(true)} onError={()=>setLandscapeError(true)}/>
        <div className="entry-fireflies" aria-hidden="true"><i/><i/><i/><i/></div>
        <div className="entry-content"><div className="entry-lantern" aria-hidden="true"/><p className="entry-eyebrow">林间来信 · 即将抵达</p><h1 className="entry-title">林间小筑</h1><p className="entry-subtitle">给日子留一点空地，给小屋点一盏灯。</p>
            <p className="entry-status" role={failed?'alert':'status'}>{status}</p>
            <div className="entry-track" role="progressbar" aria-label="素材加载进度" aria-valuemin={0} aria-valuemax={loading.total} aria-valuenow={loading.loaded}><i style={{width:percent+'%'}}/></div>
            <div className="entry-progress"><span>{ready?'准备就绪':'林间行囊'}</span><span>{loading.loaded} / {loading.total} 份素材</span></div>
            <p className="entry-note">采一枝木，生一炉火。你的林间生活，从这里开始。</p>
            <div className="entry-actions">{failed&&<button className="entry-retry" onClick={()=>{setLandscapeReady(false);setLandscapeError(false);setAttempt(v=>v+1);}}>重试加载</button>}<button onClick={()=>setEntered(true)}>先去主菜单</button></div>
        </div>
    </section>;
}
