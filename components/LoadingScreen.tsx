"use client";
import {useEffect,useState} from 'react';
import type {LoadingState} from '@/lib/client';
export const LOADING_FADE_MS=260;
export default function LoadingScreen({loading,onRetry,onExit}:{loading?:LoadingState;onRetry:()=>void;onExit:()=>void}){
    const generation=loading?.generation??0;
    const ready=loading?.phase==='ready',[finishedGeneration,setFinishedGeneration]=useState<number|null>(null);
    useEffect(()=>{if(!ready)return;const timer=setTimeout(()=>setFinishedGeneration(generation),LOADING_FADE_MS);return()=>clearTimeout(timer);},[ready,generation]);
    // A fresh connection replaces the finished loader immediately, without an effect delay.
    if(ready&&finishedGeneration===loading?.generation)return null;
    const failed=loading?.phase==='error',percent=loading?Math.floor(loading.completed/loading.total*100):0;
    const title=failed?(loading.error||'连接失败'):loading?.phase==='world'?'正在连接世界…':'正在准备小筑…';
    return <section className={'loading-screen'+(ready?' loading-ready':'')} role="dialog" aria-modal={!ready} aria-label="加载游戏" inert={ready}>
      <div className="loading-panel">
        <div className="loading-pixels" aria-hidden="true"><i/><i/><i/><i/><i/></div>
        <p role={failed?'alert':'status'}>{title}</p>
        <div className="loading-track" role="progressbar" aria-label="游戏加载进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><i style={{width:percent+'%'}}/></div>
        <span className="loading-percent">{percent}%</span>
        <div className="loading-actions">{failed&&<button autoFocus onClick={onRetry}>重试</button>}<button onClick={onExit}>返回主菜单</button></div>
      </div>
    </section>;
}
