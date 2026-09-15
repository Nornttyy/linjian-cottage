"use client";
import {useState} from 'react';
import type {Player} from '@/lib/simulation';
import {normalizeAppearance,type Appearance} from '@/lib/appearance';
import {WEARABLES,hasWearable,safeAppearance} from '@/lib/wardrobe';
import Portrait from './CharacterPortrait';
import AppearanceColors from './AppearanceColors';
export default function Wardrobe({player,onApply,onClose}:{player:Player;onApply:(a:Appearance)=>void;onClose:()=>void}){
    const [appearance,setAppearance]=useState(()=>normalizeAppearance(player.appearance));
    return <div className="character-backdrop" onClick={onClose}><section className="character-panel wardrobe-panel" role="dialog" aria-modal="true" aria-label="换装" onClick={event=>event.stopPropagation()} onKeyDown={event=>{event.stopPropagation();if(event.key==='Escape')onClose();if(event.key==='Tab'){const nodes=Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input')),first=nodes[0],last=nodes.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}}}>
        <header><h2>衣橱</h2><button autoFocus aria-label="关闭换装" onClick={onClose}>×</button></header>
        <div className="wardrobe-preview"><Portrait appearance={appearance}/><Portrait appearance={appearance} direction="right"/><Portrait appearance={appearance} direction="up"/></div>
        {(['headwear','outfit'] as const).map(slot=><fieldset className="outfit-picker" key={slot}><legend>{slot==='headwear'?'头饰':'服装'}</legend><div><button aria-pressed={!appearance[slot]} onClick={()=>setAppearance({...appearance,[slot]:undefined})}>{slot==='headwear'?'不戴头饰':'日常装'}<small>无加成</small></button>{WEARABLES.filter(item=>item.slot===slot).map(item=>{const owned=hasWearable(player,item.id);return <button key={item.id} disabled={!owned} aria-pressed={appearance[slot]===item.id} onClick={()=>setAppearance({...appearance,[slot]:item.id})}><strong>{item.name}</strong><small>{item.effect}</small>{!owned&&<span>{item.hint}</span>}</button>;})}</div></fieldset>)}
        <details className="wardrobe-dyes"><summary>分区染色</summary><AppearanceColors value={appearance} onChange={setAppearance}/></details>
        <footer><button onClick={()=>{onApply(safeAppearance(appearance,player));onClose();}}>穿上这套</button></footer>
    </section></div>;
}
