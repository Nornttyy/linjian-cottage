"use client";
import {artFilename} from '@/lib/art-sources';
import {useState} from 'react';
export type StartMode='resume'|'create'|'join'|'local';
export default function MainMenu({savedRoom,onStart}:{savedRoom:string|null;onStart:(mode:StartMode,room?:string,tutorial?:boolean)=>void}){
    const [joining,setJoining]=useState(false),[room,setRoom]=useState('');
    return <main className="main-menu cottage-menu"><div className="menu-landscape" aria-hidden="true" style={{backgroundImage:'url(./art/'+artFilename('main-menu-v1.png')+')'}}/>
        <div className="menu-fireflies" aria-hidden="true"><i/><i/><i/><i/></div>
        <section className="main-menu-panel" aria-labelledby="menu-title">
            <div className="menu-letterhead"><span className="menu-stamp" aria-hidden="true">林<br/>间</span><span>一封来自森林的邀请<small>采集 / 建造 / 慢慢生活</small></span></div>
            <h1 id="menu-title">林间小筑</h1><p className="menu-intro">把日子，安放在林间。</p>
            <div className="menu-bookmark"><i aria-hidden="true"/>{savedRoom?'有一段旅程，等你续写。':'第一间小屋，等你亲手搭起。'}</div>
            <div className="main-menu-actions">
                <button className={savedRoom?'menu-primary':undefined} disabled={!savedRoom} onClick={()=>onStart('resume')}><span className="menu-action-number" aria-hidden="true">01</span><span className="menu-action-copy">继续游戏<small>{savedRoom?'回到上次的小屋':'旅程开始后，在这里继续'}</small></span><span className="menu-action-arrow" aria-hidden="true">→</span></button>
                <button className={!savedRoom?'menu-primary':undefined} onClick={()=>onStart('create')}><span className="menu-action-number" aria-hidden="true">02</span><span className="menu-action-copy">新世界<small>从一片空地，搭起自己的生活</small></span><span className="menu-action-arrow" aria-hidden="true">→</span></button>
                <button onClick={()=>onStart('local')}><span className="menu-action-number" aria-hidden="true">03</span><span className="menu-action-copy">本机世界<small>留一段只属于自己的时光</small></span><span className="menu-action-arrow" aria-hidden="true">→</span></button>
                <button aria-expanded={joining} aria-controls="menu-join" onClick={()=>setJoining(value=>!value)}><span className="menu-action-number" aria-hidden="true">04</span><span className="menu-action-copy">加入房间<small>带上行囊，去朋友家坐坐</small></span><span className="menu-action-arrow" aria-hidden="true">{joining?'−':'+'}</span></button>
            </div>
            {joining&&<form id="menu-join" className="menu-join" onSubmit={event=>{event.preventDefault();if(/^[A-Z0-9]{8}$/.test(room))onStart('join',room);}}>
                <label htmlFor="join-code">房间号</label><div><input id="join-code" autoFocus autoComplete="off" spellCheck={false} value={room} maxLength={8} placeholder="8 位房间号" onChange={event=>setRoom(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g,''))}/><button type="submit" disabled={!/^[A-Z0-9]{8}$/.test(room)}>进入</button></div>
            </form>}
            <footer className="menu-footer"><span>不赶时间，慢慢来。</span><button onClick={()=>onStart(savedRoom?'resume':'create','',true)}>新手引导 <span aria-hidden="true">↗</span></button></footer>
        </section>
        <div className="menu-scenery-note" aria-hidden="true"><span>木与石之间，住着一些小小的愿望。</span><small>采集一日，建造一隅。</small></div>
    </main>;
}
