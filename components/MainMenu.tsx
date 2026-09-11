"use client";
import {artFilename} from '@/lib/art-sources';
import {useState} from 'react';
export type StartMode='resume'|'create'|'join';
export default function MainMenu({savedRoom,onStart}:{savedRoom:string|null;onStart:(mode:StartMode,room?:string,tutorial?:boolean)=>void}){
    const [joining,setJoining]=useState(false),[room,setRoom]=useState('');
    return <main className="main-menu"><div className="menu-landscape" aria-hidden="true" style={{backgroundImage:'url(./art/'+artFilename('main-menu-v1.png')+')'}}/>
        <section className="main-menu-panel" aria-labelledby="menu-title">
            <h1 id="menu-title">林间小筑</h1><p className="menu-intro">采集 · 建造 · 和朋友一起生活</p>
            <div className="main-menu-actions">
                <button className={savedRoom?'menu-primary':undefined} disabled={!savedRoom} onClick={()=>onStart('resume')}>继续游戏{savedRoom&&<small>{savedRoom}</small>}</button>
                <button className={!savedRoom?'menu-primary':undefined} onClick={()=>onStart('create')}>新世界</button>
                <button aria-expanded={joining} aria-controls="menu-join" onClick={()=>setJoining(value=>!value)}>加入房间</button>
                <button onClick={()=>onStart(savedRoom?'resume':'create','',true)}>新手引导</button>
            </div>
            {joining&&<form id="menu-join" className="menu-join" onSubmit={event=>{event.preventDefault();if(/^[A-Z0-9]{8}$/.test(room))onStart('join',room);}}>
                <label htmlFor="join-code">房间号</label><div><input id="join-code" autoFocus autoComplete="off" spellCheck={false} value={room} maxLength={8} placeholder="8 位房间号" onChange={event=>setRoom(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g,''))}/><button type="submit" disabled={!/^[A-Z0-9]{8}$/.test(room)}>进入</button></div>
            </form>}
        </section>
    </main>;
}
