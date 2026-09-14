"use client";
import {useState,useSyncExternalStore} from 'react';
import {artFilename} from '@/lib/art-sources';
import {characterSnapshot,serverCharacterSnapshot,subscribeCharacters,readCharacters,characterSession,createCharacter,selectCharacter,renameCharacter,type Character} from '@/lib/characters';
import type {StartMode} from './MainMenu';
function Portrait(){return <span className="character-portrait" aria-hidden="true"><span style={{backgroundImage:`url(./art/${artFilename('hero-walk-v2.png')})`}}/></span>;}
export default function CharacterMenu({mode,onChoose,onBack,initialError=''}:{mode:StartMode;onChoose:(hero:Character)=>void;onBack:()=>void;initialError?:string}){
    const raw=useSyncExternalStore(subscribeCharacters,characterSnapshot,serverCharacterSnapshot),list=readCharacters(raw);
    const [name,setName]=useState(''),[editing,setEditing]=useState<string|null>(null),[error,setError]=useState(initialError);
    const attempt=(action:()=>void)=>{try{action();setError('');}catch(cause){setError(cause instanceof Error&&cause.message.includes('名字')?cause.message:'此设备暂时无法保存角色，请检查浏览器储存空间。');}};
    return <main className="main-menu"><div className="menu-landscape" aria-hidden="true" style={{backgroundImage:`url(./art/${artFilename('main-menu-v1.png')})`}}/><div className="character-backdrop"><section className="character-panel" role="dialog" aria-modal="true" aria-labelledby="character-title" onKeyDown={event=>{if(event.key==='Tab'){const controls=Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input')),first=controls[0],last=controls.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}if(event.key==='Escape'){event.stopPropagation();onBack();}}}>
        <header><div><span>林间小筑</span><h2 id="character-title">选择角色</h2></div><button className="close" autoFocus={mode==='resume'} aria-label="返回主菜单" onClick={()=>onBack()}>×</button></header>
        <p className="character-intro">选一位旅人，继续自己的林间生活。{mode==='resume'?'选择有存档的角色，继续上次的世界。':'选好角色后进入游戏。'}</p>
        <div className="character-list">{list.characters.map(hero=>{const session=characterSession(hero.id);return <article key={hero.id} className={'character-card'+(list.active===hero.id?' selected':'')}>
            <Portrait/><div><h3>{hero.name}</h3><p>{session?`${session.local?'本机世界':'多人房间'} · ${session.room}`:'新的旅程'}</p><small>{session?'背包、建筑和食谱随世界保存':'进入游戏后开始冒险'}</small></div>
            <div className="character-card-actions"><button disabled={mode==='resume'&&!session} onClick={()=>attempt(()=>{if(mode==='resume'&&!characterSession(hero.id))return;selectCharacter(hero.id);onChoose(hero);})}>{mode==='resume'?(session?'继续游戏':'暂无存档'):mode==='join'?'加入房间':'开始游戏'}</button><button onClick={()=>{setEditing(hero.id);setName(hero.name);}}>改名</button></div>
        </article>;})}</div>
        {(mode!=='resume'||editing)&&<form className="character-create" onSubmit={event=>{event.preventDefault();attempt(()=>{if(editing)renameCharacter(editing,name);else createCharacter(name);setName('');setEditing(null);});}}>
            <label htmlFor="character-name">{editing?'修改名字':'新建角色'}</label><div><input autoFocus id="character-name" placeholder="给旅人取个名字" maxLength={16} value={name} onChange={event=>setName(event.target.value)}/><button type="submit" disabled={!name.trim()}>{editing?'保存':'创建'}</button>{editing&&<button type="button" onClick={()=>{setEditing(null);setName('');}}>取消</button>}</div>
        </form>}{mode==='resume'&&!list.characters.some(hero=>characterSession(hero.id))&&<p>还没有可继续的存档，请返回主菜单开始新世界。</p>}{error&&<p role="alert">{error}</p>}
        <footer><button onClick={()=>onBack()}>返回主菜单</button></footer>
    </section></div></main>;
}
