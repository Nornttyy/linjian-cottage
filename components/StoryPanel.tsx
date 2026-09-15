"use client";
import type {Player,WorldState} from '@/lib/simulation';
import {storyStage,storyObjective,STORY_STAGES} from '@/lib/story';
export default function StoryPanel({player,world,onAction,onTrack,onClose,status}:{player:Player;world:WorldState;onAction:()=>void;onTrack:()=>void;onClose:()=>void;status?:string}){
    const stage=storyStage(player),chapter=STORY_STAGES[stage-1];
    return <div className="character-backdrop" onClick={onClose}><section className="character-panel story-panel" role="dialog" aria-modal="true" aria-label="可选主线" onClick={event=>event.stopPropagation()} onKeyDown={event=>{event.stopPropagation();if(event.key==='Escape')onClose();if(event.key==='Tab'){const controls=Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button')),first=controls[0],last=controls.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}}}>
        <header><div><span>可选主线 · {Math.min(3,Math.max(0,stage-1))}/3</span><h2>重亮林间驿站</h2></div><button autoFocus aria-label="关闭主线" onClick={onClose}>×</button></header>
        <h3>{storyObjective(player,world)}</h3><p>{stage===0?'营地有一张旧地图，终点是一座熄灯的驿站。愿意的话，把这条小路重新接起来。':stage===4?'你留下了饭，也留下了灯。森林里又多了一个能停下来的地方。':chapter.text}</p>
        {chapter&&'target'in chapter&&<p className="story-location">目的地：{stage===1?'林间营地':'日光石环'}</p>}
        {stage>0&&stage<4&&<button onClick={onTrack}>{player.storyTracked?'停止追踪':'追踪这段旅程'}</button>}
        {status&&<p role="status">{status}</p>}
        <footer>{stage<4&&<button onClick={onAction}>{stage===0?'接下这段旅程':stage===3&&world.beaconLit?'查看修复的驿站':chapter.button}</button>}</footer>
    </section></div>;
}
