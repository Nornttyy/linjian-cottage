"use client";
import {useState,useSyncExternalStore} from 'react';
import {artFilename} from '@/lib/art-sources';
import {characterSnapshot,serverCharacterSnapshot,subscribeCharacters,readCharacters,characterSession,createCharacter,selectCharacter,renameCharacter,type Character} from '@/lib/characters';
import Portrait from './CharacterPortrait';
import {CLOTHING_COLORS,DEFAULT_APPEARANCE,normalizeAppearance,type Appearance,type ClothingColor} from '@/lib/appearance';
import type {Direction} from '@/lib/art';
import type {StartMode} from './MainMenu';

export default function CharacterMenu({mode,onChoose,onBack,initialError=''}:{mode:StartMode;onChoose:(hero:Character,newWorld?:boolean)=>void;onBack:()=>void;initialError?:string}){
    const raw=useSyncExternalStore(subscribeCharacters,characterSnapshot,serverCharacterSnapshot),list=readCharacters(raw);
    const [name,setName]=useState(''),[editing,setEditing]=useState<string|null>(null),[error,setError]=useState(initialError);
    const [appearance,setAppearance]=useState<Appearance>(DEFAULT_APPEARANCE),[direction,setDirection]=useState<Direction>('down');
    const [creating,setCreating]=useState(list.characters.length===0);
    const closeEditor=()=>{setCreating(false);setEditing(null);setName('');setAppearance(DEFAULT_APPEARANCE);setDirection('down');};
    const attempt=(action:()=>void)=>{try{action();setError('');}catch(cause){setError(cause instanceof Error&&cause.message.includes('名字')?cause.message:'此设备暂时无法保存角色，请检查浏览器储存空间。');}};
    return <main className="main-menu"><div className="menu-landscape" aria-hidden="true" style={{backgroundImage:`url(./art/${artFilename('main-menu-v1.png')})`}}/><div className="character-backdrop"><section className="character-panel" role="dialog" aria-modal="true" aria-labelledby="character-title" onKeyDown={event=>{if(event.key==='Tab'){const controls=Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input')),first=controls[0],last=controls.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}if(event.key==='Escape'){event.stopPropagation();onBack();}}}>
        <header><div><span>林间小筑 / 旅人名册</span><h2 id="character-title">选择角色</h2></div><button className="close" autoFocus={mode==='resume'} aria-label="返回主菜单" onClick={()=>onBack()}>×</button></header>
        <p className="character-intro">每一位旅人，都有自己的小筑故事。{mode==='resume'?'选择有存档的角色，继续上次的世界。':'选好角色后进入游戏。'}</p>
        <div className="character-toolbar"><span>我的角色 · {list.characters.length}</span><button aria-expanded={creating} onClick={()=>{closeEditor();setError('');setCreating(true);}}>添加角色</button></div>
        <div className="character-list">{list.characters.map((hero,index)=>{const session=characterSession(hero.id);return <article key={hero.id} className={'character-card'+(list.active===hero.id?' selected':'')}>
            <Portrait appearance={hero.appearance}/><div><span className="character-card-number">旅人 {String(index+1).padStart(2,'0')}</span><h3>{hero.name}</h3><p>{session?`${session.local?'本机世界':'多人房间'} · ${session.room}`:'新的旅程'}</p><small>{session?'背包、建筑和食谱随世界保存':'进入游戏后开始冒险'}</small></div>
            <div className="character-card-actions"><button onClick={()=>attempt(()=>{selectCharacter(hero.id);onChoose(hero,mode==='resume'&&!characterSession(hero.id));})}>{mode==='resume'?(session?'继续游戏':'开始新世界'):mode==='join'?'加入房间':'开始游戏'}</button><button onClick={()=>{closeEditor();setEditing(hero.id);setName(hero.name);setAppearance(normalizeAppearance(hero.appearance));setError('');}}>改名 / 换装</button></div>
        </article>;})}</div>
        {(creating||editing)&&<form className="character-create" onSubmit={event=>{event.preventDefault();attempt(()=>{if(editing)renameCharacter(editing,name,appearance);else createCharacter(name,appearance);closeEditor();});}}>
            <label htmlFor="character-name">{editing?'修改角色':'新建角色'}</label><div><input autoFocus id="character-name" placeholder="给旅人取个名字" maxLength={16} value={name} onChange={event=>setName(event.target.value)}/><button type="submit" disabled={!name.trim()}>{editing?'保存':'创建'}</button><button type="button" onClick={closeEditor}>取消</button></div>
            <div className="character-wardrobe"><div className="wardrobe-preview"><Portrait appearance={appearance} direction={direction}/><div aria-label="预览方向">{([['down','正面'],['right','侧面'],['up','背面']] as const).map(([dir,label])=><button key={dir} type="button" onClick={()=>setDirection(dir)} aria-pressed={direction===dir}>{label}</button>)}</div></div><div className="wardrobe-options">
                <fieldset><legend>角色</legend><div className="body-options">{([['male','男角色'],['female','女角色']] as const).map(([body,label])=><button type="button" key={body} aria-pressed={appearance.body===body} onClick={()=>setAppearance({...appearance,body})}>{label}</button>)}</div></fieldset>
                {([['shirt','上衣'],['pants','裤子']] as const).map(([part,label])=><fieldset key={part}><legend>{label} · {CLOTHING_COLORS[appearance[part]].name}</legend><div className="clothing-swatches">{(Object.keys(CLOTHING_COLORS) as ClothingColor[]).map(color=><button type="button" key={color} className="clothing-swatch" title={CLOTHING_COLORS[color].name} aria-label={label+'颜色：'+CLOTHING_COLORS[color].name} aria-pressed={appearance[part]===color} style={{backgroundColor:color==='original'&&part==='pants'?'#43a8df':CLOTHING_COLORS[color].color}} onClick={()=>setAppearance({...appearance,[part]:color})}>{appearance[part]===color?'✓':''}</button>)}</div></fieldset>)}
            </div></div>
        </form>}{error&&<p role="alert">{error}</p>}
        <footer><button onClick={()=>onBack()}>返回主菜单</button></footer>
    </section></div></main>;
}
