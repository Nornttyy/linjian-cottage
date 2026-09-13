"use client";
import {useEffect,useRef,useState,type RefObject} from 'react';
import type {GameClient} from '@/lib/client';
import {FISHING_BAR_SIZE,fishingActive,type FishingState} from '@/lib/fishing';
import {INGREDIENTS} from '@/lib/cooking';
import Icon from './ItemIcon';

const escapeText={missed:'鱼游走了',lost:'鱼挣脱了',timeout:'下次再试',cancelled:'已收竿',hurt:'钓鱼被打断',moved:'已离开钓点',disconnected:'连接中断，已收竿'} as const;
export default function FishingGame({client,hidden=false}:{client:RefObject<GameClient|null>;hidden?:boolean}){
    const [state,setState]=useState<FishingState>(),[held,setHeld]=useState(false);
    const pointer=useRef<number|null>(null),lastPhase=useRef('');
    useEffect(()=>{
        let frame=0,last=0;
        const tick=(time:number)=>{if(time-last>=32){last=time;const next=client.current?.getFishingView(),expired=next&&!fishingActive(next)&&(client.current?.serverNow()??0)-(next.finishedAt??0)>2600;setState(expired?undefined:next);if(next?.phase!==lastPhase.current){lastPhase.current=next?.phase??'';if(!fishingActive(next))setHeld(false);}}frame=requestAnimationFrame(tick);};
        frame=requestAnimationFrame(tick);
        const release=()=>{pointer.current=null;setHeld(false);client.current?.fishingPress(false);};
        const visibility=()=>{if(document.hidden)release();};
        window.addEventListener('blur',release);window.addEventListener('pagehide',release);document.addEventListener('visibilitychange',visibility);
        return()=>{cancelAnimationFrame(frame);release();window.removeEventListener('blur',release);window.removeEventListener('pagehide',release);document.removeEventListener('visibilitychange',visibility);};
    },[client]);
    if(hidden||!state)return null;
    const active=fishingActive(state),reeling=state.phase==='reeling',bite=state.phase==='bite',caught=state.phase==='caught';
    const title=caught?'收获了':state.phase==='escaped'?escapeText[state.reason??'lost']:reeling?'跟住鱼的节奏':bite?'咬钩了':'等一等，鱼快来了';
    const release=(id:number)=>{if(pointer.current!==id)return;pointer.current=null;setHeld(false);client.current?.fishingPress(false);};
    return <section className={'fishing-game phase-'+state.phase} aria-label="钓鱼小游戏">
        <header><div><span>{state.region==='coast'?'南部河口':'林间河流'}</span><h2 aria-live="polite">{title}</h2></div>{active&&<button onClick={()=>client.current?.cancelFishing()} aria-label="收竿退出钓鱼">×</button>}</header>
        {reeling?<>
            <div className="fishing-reel">
                <div className="fishing-track" aria-label="控条追鱼"><div className={'fishing-catch-zone'+(Math.abs(state.fishPosition-state.barCenter)<=FISHING_BAR_SIZE/2?' overlapping':'')} style={{height:FISHING_BAR_SIZE*100+'%',bottom:(state.barCenter-FISHING_BAR_SIZE/2)*100+'%'}}/><div className="fishing-target" style={{bottom:state.fishPosition*100+'%'}}><Icon name="fish" size={28}/></div></div>
                <div className="fishing-progress-info"><span>收鱼进度</span><strong>{Math.floor(state.progress*100)}%</strong><div className="fishing-progress" role="progressbar" aria-label="收鱼进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.floor(state.progress*100)}><i style={{height:state.progress*100+'%'}}/></div></div>
            </div>
            <p>按住上升，松开下降<br/>让鱼留在绿色区域</p>
        </>:active?<div className="fishing-wait"><Icon name="rod" size={50}/><div className="fishing-ripples"><i/><i/><i/></div><p>{bite?'现在提竿':'浮漂动了，再提竿'}</p></div>:caught?<div className="fishing-catch-result"><Icon name={state.catchId} size={52}/><strong>{INGREDIENTS[state.catchId].name} ×1</strong><span>已放入背包</span></div>:<p className="fishing-ended">随时可以再抛一次。</p>}
        {active&&<button className={'fishing-hold'+(held?' held':'')} disabled={state.phase==='waiting'} aria-label={bite?'提竿':'按住收线'} aria-pressed={held}
            onPointerDown={event=>{if(pointer.current!==null)return;event.preventDefault();pointer.current=event.pointerId;event.currentTarget.setPointerCapture?.(event.pointerId);setHeld(true);client.current?.fishingPress(true);}}
            onPointerUp={event=>release(event.pointerId)} onPointerCancel={event=>release(event.pointerId)} onLostPointerCapture={event=>release(event.pointerId)}
            onKeyDown={event=>{if(event.key===' '||event.key==='Enter'){event.preventDefault();event.stopPropagation();if(!event.repeat){setHeld(true);client.current?.fishingPress(true);}}}}
            onKeyUp={event=>{if(event.key===' '||event.key==='Enter'){event.preventDefault();event.stopPropagation();setHeld(false);client.current?.fishingPress(false);}}}>
            {bite?'提竿':reeling?'按住收线':'等待咬钩'}<kbd>空格</kbd>
        </button>}
    </section>;
}
