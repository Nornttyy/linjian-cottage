"use client";
import {useEffect,useRef,useState} from 'react';
import type {ClientState} from '@/lib/client';
import {TUTORIAL_STEPS,LESSONS,tutorialKey,readTutorial,startTutorial,observeTutorial,type TutorialProgress,type TutorialTracker} from '@/lib/tutorial';
export default function Tutorial({state,restart=0,hidden=false,onDismiss}:{state:ClientState;restart?:number;hidden?:boolean;onDismiss?:()=>void}){
    const tracker=useRef<TutorialTracker|null>(null),lastRestart=useRef<number|undefined>(undefined);
    const [progress,setProgress]=useState<TutorialProgress|null>(null);
    const [counts,setCounts]=useState<TutorialTracker['counts']>({});
    useEffect(()=>{
        if(restart<=0||state.loading.phase!=='ready'||!state.connected||!state.session||!state.world.players[state.session.playerId])return;
        const key=tutorialKey(state.session);
        if(!tracker.current||lastRestart.current!==restart){
            let saved=readTutorial(null);try{saved=readTutorial(localStorage.getItem(key));}catch{}
            saved.dismissed=false;tracker.current=startTutorial(state,saved);lastRestart.current=restart;
        }
        const next=observeTutorial(tracker.current,state);setProgress({...next});setCounts({...tracker.current.counts});
        try{localStorage.setItem(key,JSON.stringify(next));}catch{}
    },[state,restart]);
    const dismiss=()=>{if(!tracker.current||!state.session)return;const next={...tracker.current.progress,dismissed:true};tracker.current.progress=next;setProgress(next);try{localStorage.setItem(tutorialKey(state.session),JSON.stringify(next));}catch{}onDismiss?.();};
    if(restart<=0||!progress||progress.dismissed||hidden)return null;
    const step=TUTORIAL_STEPS.find(item=>!progress.done.includes(item)),lesson=step?LESSONS[step]:null;
    const count=step?Math.min(lesson!.goal,counts[step]||0):0;
    return <aside className="tutorial-card" aria-label="新手引导">
        <header><span>{lesson?.chapter??'安家完成'} · {progress.done.length}/{TUTORIAL_STEPS.length}</span><button onClick={dismiss}>收起</button></header>
        <div aria-live="polite"><h2>{lesson?.title??'灯亮了，饭好了，你也回家了。'}{lesson&&<b className="tutorial-count">{count}/{lesson.goal}</b>}</h2></div>
        {lesson?<details key={step} className="tutorial-help"><summary>怎么做</summary><p>{lesson.hint}</p></details>:<p>从这里出发，继续自己的林间生活。</p>}
        <div className="tutorial-progress" role="progressbar" aria-label="安家旅程" aria-valuemin={0} aria-valuemax={TUTORIAL_STEPS.length} aria-valuenow={progress.done.length}><i className="done" style={{flex:'0 0 '+progress.done.length/TUTORIAL_STEPS.length*100+'%'}}/><i/></div>
    </aside>;
}
