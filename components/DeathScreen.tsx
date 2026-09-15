"use client";
import type {Player} from '@/lib/simulation';
import {RESPAWN_DELAY_MS} from '@/lib/death';
export default function DeathScreen({player,time,connected,onRespawn,onExit}:{player:Player;time:number;connected:boolean;onRespawn:()=>void;onExit:()=>void}){
    const death=player.death;if(!death)return null;
    const remaining=Math.max(0,Math.ceil((RESPAWN_DELAY_MS-(time-death.at))/1000));
    return <section className="death-screen" role="dialog" aria-modal="true" aria-label="角色倒下" onKeyDown={event=>{event.stopPropagation();if(event.key==='Tab'){const nodes=Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')),first=nodes[0],last=nodes.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}}}><div>
        <span className="death-mark" aria-hidden="true"/><h2>你倒下了</h2><p>{death.cause}</p><small>背包与装扮保留</small>
        <button autoFocus disabled={remaining>0||!connected} onClick={onRespawn}>{!connected?'等待连接…':remaining?`${remaining} 秒后可复活`:'回到营地'}</button><button onClick={onExit}>返回主菜单</button>
    </div></section>;
}
