"use client";
import {useEffect,useRef,useState} from 'react';
import type {ClientState} from '@/lib/client';
import {TUTORIAL_STEPS,tutorialKey,readTutorial,startTutorial,observeTutorial,type TutorialProgress,type TutorialTracker,type TutorialStep} from '@/lib/tutorial';
const lessons:Record<TutorialStep,{title:string;text:string}>= {
    move:{title:'去附近走走',text:'WASD 或左下方向键，走动三格以上。'},
    wood:{title:'收集第一份木材',text:'选斧头，靠近树干按住点击，直到获得木材。'},
    floor:{title:'铺一块地板',text:'选建造锤 → 地板，在营火外的空地点击放置。'},
    wall:{title:'建起第一面墙',text:'选木墙，在地板上放置；先离开要放墙的格子。'},
    combat:{title:'试试保护自己',text:'选剑，靠近怪物点击命中一次；空格可闪避。'}
};
export default function Tutorial({state,restart=0,hidden=false,onDismiss}:{state:ClientState;restart?:number;hidden?:boolean;onDismiss?:()=>void}){
    const tracker=useRef<TutorialTracker|null>(null),lastRestart=useRef<number|undefined>(undefined);
    const [progress,setProgress]=useState<TutorialProgress|null>(null);
    useEffect(()=>{
        if(restart<=0||state.loading.phase!=='ready'||!state.connected||!state.session||!state.world.players[state.session.playerId])return;
        const key=tutorialKey(state.session),reset=lastRestart.current!==restart&&restart>0;
        if(!tracker.current||reset){
            let saved:TutorialProgress=readTutorial(null);if(!reset)try{saved=readTutorial(localStorage.getItem(key));}catch{}
            tracker.current=startTutorial(state,saved);lastRestart.current=restart;
            if(reset)try{localStorage.setItem(key,JSON.stringify(saved));}catch{}
            setProgress(tracker.current.progress);
            if(tracker.current.progress!==saved)try{localStorage.setItem(key,JSON.stringify(tracker.current.progress));}catch{}
        }
        const before=tracker.current.progress,next=observeTutorial(tracker.current,state);
        if(next!==before){setProgress(next);try{localStorage.setItem(key,JSON.stringify(next));}catch{}}
    },[state,restart]);
    const dismiss=()=>{if(!tracker.current||!state.session)return;const next={...tracker.current.progress,dismissed:true};tracker.current.progress=next;setProgress(next);try{localStorage.setItem(tutorialKey(state.session),JSON.stringify(next));}catch{}onDismiss?.();};
    if(restart<=0||!progress||progress.dismissed||hidden)return null;
    const step=TUTORIAL_STEPS.find(item=>!progress.done.includes(item)),lesson=step?lessons[step]:null;
    return <aside className="tutorial-card" aria-label="新手引导">
        <header><span>新手引导 · {progress.done.length} / {TUTORIAL_STEPS.length}</span><button onClick={dismiss}>{step?'跳过':'收起'}</button></header>
        <div aria-live="polite"><h2>{lesson?.title??'小筑生活，已经开始'}</h2><p>{lesson?.text??'自由探索、耕种和建造。菜单里可以重看引导。'}</p></div>
        {step==='floor'&&!progress.hammer&&<small>E 打开背包，可把建造锤拖到任意快捷栏。</small>}
        <div className="tutorial-progress" aria-hidden="true">{TUTORIAL_STEPS.map(item=><i key={item} className={progress.done.includes(item)?'done':item===step?'current':''}/>)}</div>
    </aside>;
}
