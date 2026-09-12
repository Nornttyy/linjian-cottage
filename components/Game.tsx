"use client";
import { useEffect, useRef, useState } from 'react';
import { GameClient, type ClientState } from '@/lib/client';
import Icon from './ItemIcon';
import InventoryPanel from './Inventory';
import SignPanel from './SignPanel';
import Tutorial from './Tutorial';
import Minimap from './Minimap';
import LoadingScreen from './LoadingScreen';
import TouchControls from './TouchControls';
import type {StartMode} from './MainMenu';
import {HOTBAR_SIZE,ITEMS,itemCount,itemDescription,visibleItem,defaultSlots} from '@/lib/inventory';
import {sceneAt,CAVE_ENTRANCE} from '@/lib/world';
import {PART_NAMES,floorLevel,type Part} from '@/lib/structures';
import {buildCost} from '@/lib/simulation';
import { paintMap, regionAt, buildTarget } from '@/lib/renderer';

export default function Game({ apiUrl = '/api/game',startMode='resume',initialRoom='',onExit,onTutorial,tutorialRun=0 }: { apiUrl?: string;startMode?:StartMode;initialRoom?:string;onExit?:()=>void;onTutorial?:()=>void;tutorialRun?:number }) {
    const canvas = useRef<HTMLCanvasElement>(null), mapCanvas = useRef<HTMLCanvasElement>(null), client = useRef<GameClient | null>(null), noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const hotbarDrag=useRef<number|null>(null);
    const [state, setState] = useState<ClientState | null>(null), [map, setMap] = useState(false), [room, setRoom] = useState(false), [backpack,setBackpack]=useState(false), [roomCode, setRoomCode] = useState(''), [notice, setNotice] = useState(''),[trackCave,setTrackCave]=useState(false);
    const [signId,setSignId]=useState<string|null>(null);
    const [buildPreview,setBuildPreview]=useState<{x:number;y:number;level:number;removing:boolean}|null>(null);
    const [menu,setMenu]=useState(false);
    const [tutorialStoppedAt,setTutorialStoppedAt]=useState(0);
    const loading=state?.loading,loaded=loading?.phase==='ready';
    const showNotice = (text: string) => { setNotice(text); if (noticeTimer.current)
        clearTimeout(noticeTimer.current); noticeTimer.current = setTimeout(() => setNotice(''), 1400); };
    useEffect(() => { const game = new GameClient(canvas.current!, setState, showNotice, () => {setMap(v => !v);setRoom(false);setBackpack(false);setSignId(null);}, apiUrl, () => {setBackpack(v=>!v);setMap(false);setRoom(false);setSignId(null);}, id=>{setSignId(id);if(id){setMap(false);setRoom(false);setBackpack(false);}}); client.current = game; game.connect(startMode,initialRoom); return () => { game.destroy(); if (noticeTimer.current)
        clearTimeout(noticeTimer.current); }; }, [apiUrl,startMode,initialRoom]);
    useEffect(() => { if (client.current) {
        client.current.paused = map || room || backpack || signId!==null || menu;
        client.current.pauseControls();
    } }, [map, room, backpack,signId,menu]);
    useEffect(() => { if (map && mapCanvas.current && state?.session)
        paintMap(mapCanvas.current, state.world, state.session.playerId,state.art); }, [map, state]);
    useEffect(() => { const close = (e: KeyboardEvent) => { if(e.key==='Escape'){setMenu(false);setMap(false);setRoom(false);setBackpack(false);setSignId(null);client.current?.closeSign();} }; window.addEventListener('keydown',close); return () => window.removeEventListener('keydown',close); }, []);
    useEffect(()=>{
        if(state?.tool!=='build'||state.remove||map||room||backpack||signId||menu)return;
        const game=client.current;if(!game)return;
        let frame=0,last='',removing=false;
        const update=()=>{
            const pos=game.pos,level=floorLevel(pos),point=game.pointer??{x:pos.x+(pos.face==='right'?1:pos.face==='left'?-1:0),y:pos.y+(pos.face==='down'?1:pos.face==='up'?-1:0)};
            const cell=buildTarget(point,game.world,false,level),key=`${cell.x}:${cell.y}:${level}:${removing}`;
            if(key!==last){last=key;setBuildPreview({...cell,level,removing});}
        };
        const tick=()=>{update();frame=requestAnimationFrame(tick);};
        const down=(event:PointerEvent)=>{if(event.button===2){removing=true;update();}};
        const up=()=>{if(removing){removing=false;update();}};
        game.canvas.addEventListener('pointerdown',down);window.addEventListener('pointerup',up);window.addEventListener('blur',up);tick();
        return()=>{cancelAnimationFrame(frame);game.canvas.removeEventListener('pointerdown',down);window.removeEventListener('pointerup',up);window.removeEventListener('blur',up);};
    },[state?.tool,state?.remove,map,room,backpack,signId,menu]);
    const openMenu=()=>{client.current?.pauseControls();setMenu(true);setMap(false);setRoom(false);setBackpack(false);setSignId(null);client.current?.closeSign();};
    const leave=()=>{if(client.current){client.current.paused=true;client.current.pauseControls();}onExit?.();};
    const closeSign=()=>{setSignId(null);client.current?.closeSign();};
    const sign=signId?state?.world.buildings[signId]:undefined;
    const player = state?.session ? state.world.players[state.session.playerId] : undefined, inventory = player?.inventory;
    const slots=state?.slots??defaultSlots(),selected=state?.selectedSlot??0,activeItem=visibleItem(slots[selected],inventory);
    const touchUseLabel=state?.remove?'拆除':activeItem==='hammer'?'建造':activeItem==='sword'?'攻击':activeItem==='rod'?'抛竿':activeItem?'使用':'空手';
    const openBackpack=()=>{client.current?.pauseControls();setBackpack(true);setMap(false);setRoom(false);};
    const level=player?floorLevel(player):0,stairs=state&&player?Object.values(state.world.buildings).filter(b=>b.kind==='stairs'&&Math.hypot(player.x-b.x-.5,player.y-b.y-.5)<2.3):[];
    const up=stairs.find(b=>floorLevel(b)===level),down=stairs.find(b=>floorLevel(b)===level-1);
    const caveDistance=player?Math.round(Math.hypot(player.x-CAVE_ENTRANCE.x,player.y-CAVE_ENTRANCE.y)):0;
    const buildLevel=buildPreview?.level??level,buildX=buildPreview?.x??Math.floor(player?.x??0),buildY=buildPreview?.y??Math.floor(player?.y??0);
    const costs:Partial<Record<'wood'|'stone'|'copper',number>>=state?buildCost(state.world,buildX,buildY,state.part,buildLevel):{};
    const removing=state?.remove||buildPreview?.removing;
    const count = state ? Object.values(state.world.players).filter(p => state.world.tick - p.seen < 15000).length : 0;
    const localWorld=state?.session?.local===true;
    const showConnectionError=Boolean(loaded&&state?.error&&!room&&!backpack&&signId===null&&!menu);
    return <main className="game-shell"><div className={'game-view'+(state?.tool==='build'?' is-building':'')+(showConnectionError?' has-error':'')} inert={!loaded||map||room||backpack||signId!==null||menu} aria-hidden={!loaded}>
  <canvas ref={canvas} className="world-canvas" aria-label="游戏场景：使用方向控制移动，选择快捷栏物品后点击场景或按使用键操作"/>
  <header className="hud-top"><div className="identity"><h1>林间小筑</h1><span className={'connection-dot ' + (state?.connected ? 'online' : '')} title={state?.connected ? localWorld?(state.localSaved?'本机保存':'本机游玩，无法保存'):'已连接并保存' : '连接中'}/></div>
   <div className="region-label">{player ? regionAt(player.x, player.y) : '林间营地'}{level>0&&<span> · {level+1}层</span>}</div>
   <div className="top-actions"><button onClick={openMenu} title="游戏菜单">菜单</button><button onClick={openBackpack} title="背包 · E">背包 <kbd>E</kbd></button><button onClick={() => setMap(true)} title="世界地图 · M">地图 <kbd>M</kbd></button><button onClick={() => setRoom(true)} title="多人房间">联机 <span>{localWorld?'单机':count+'/4'}</span></button></div>
  </header>
  {trackCave&&player&&sceneAt(player.x)!=='mine'&&<button className="cave-bearing" onClick={()=>setTrackCave(false)} title="取消矿洞标记"><i style={{transform:`rotate(${Math.atan2(CAVE_ENTRANCE.y-player.y,CAVE_ENTRANCE.x-player.x)+Math.PI/2}rad)`}}/>矿洞 · {caveDistance}格</button>}
  <section className="vitals" aria-label="角色状态"><div className="health-row"><Icon name="heart" size={16}/><div className="meter health-meter" role="progressbar" aria-label="生命" aria-valuenow={Math.round(player?.hp || 0)} aria-valuemax={100}><i style={{ width: (player?.hp || 0) + '%' }}/></div><span>{Math.round(player?.hp || 0)}</span></div><div className="stamina-row"><Icon name="stamina" size={14}/><div className="meter stamina-meter" role="progressbar" aria-label="体力" aria-valuenow={Math.round(player?.stamina || 0)} aria-valuemax={100}><i style={{ width: (player?.stamina || 0) + '%' }}/></div></div></section>
  {tutorialRun>tutorialStoppedAt&&state?.session&&<Tutorial key={state.session.room+':'+state.session.playerId} state={state} restart={tutorialRun} hidden={!loaded||map||room||backpack||signId!==null||menu} onDismiss={()=>setTutorialStoppedAt(tutorialRun)}/>}
  {loaded&&state?.connected&&<Minimap client={client} hidden={map||room||backpack||signId!==null||menu} onOpen={()=>{client.current?.pauseControls();setMap(true);}}/>}
  <div className="bottom-controls">
   {(up||down)&&<div className="stairs-controls">{up&&<button onClick={()=>client.current?.command({type:'ascend',target:up.id})}><Icon name="ascend" size={14}/>上楼 <kbd>F</kbd></button>}{down&&<button onClick={()=>client.current?.command({type:'descend',target:down.id})}><Icon name="descend" size={14}/>下楼 <kbd>Shift F</kbd></button>}</div>}
   {state?.tool==='build'&&<section className={'build-menu'+(removing?' is-removing':'')} aria-label="建造菜单">
       <nav className="build-palette" aria-label="建造锤构件">{(Object.keys(PART_NAMES) as Part[]).map(part=><button key={part} onClick={()=>client.current?.setPart(part)} className={state.part===part&&!state.remove?'active':''} aria-pressed={state.part===part&&!state.remove} title={PART_NAMES[part]}><Icon name={part} size={22}/><span>{PART_NAMES[part]}</span></button>)}<button onClick={()=>client.current?.toggleRemove()} className={state.remove?'active':''} aria-pressed={state.remove} title="拆除 · X"><Icon name="remove" size={22}/><span>拆除</span></button></nav>
       {!removing&&<div className="build-materials" aria-label={PART_NAMES[state.part]+'所需材料'}>
           <header><strong>{PART_NAMES[state.part]}</strong><span>所需 / 拥有</span></header>
           <ul>{(['wood','stone','copper'] as const).map(item=>{
               const needed=costs[item]??0,owned=inventory?.[item]??0,missing=Math.max(0,needed-owned);
               return <li key={item} className={missing?'insufficient':needed?'':'unused'} aria-label={`${ITEMS[item].name}：需要${needed}，拥有${owned}${missing?'，缺'+missing:''}`}>
                   <Icon name={ITEMS[item].icon} size={16}/><span>{ITEMS[item].name}</span><b>{needed} / {owned}</b>{missing>0&&<em>缺{missing}</em>}
               </li>;
           })}</ul>
       </div>}
   </section>}

   {notice && <div className="notice" role="status">{notice}</div>}
   {activeItem&&(state?.tool!=='build'||state.remove)&&<div className="selected-item-name">{state?.remove?'拆除':activeItem==='hammer'?'建造锤 · '+PART_NAMES[state?.part??'floor']:ITEMS[activeItem].name}</div>}
   <nav className="hotbar minecraft-hotbar" aria-label="九格快捷栏" onWheel={event=>{if(event.deltaY&&!event.ctrlKey)client.current?.selectSlot((selected+(event.deltaY>0?1:-1)+HOTBAR_SIZE)%HOTBAR_SIZE);}}>{slots.slice(0,HOTBAR_SIZE).map((slot,index)=>{
       const item=visibleItem(slot,inventory),entry=item?ITEMS[item]:null;
       return <button key={index} className={selected===index?'selected':''} draggable={!!item}
           onDragStart={event=>{if(!item){event.preventDefault();return;}client.current?.pauseControls();hotbarDrag.current=index;event.dataTransfer.setData('application/x-linjian-hotbar',String(index));event.dataTransfer.effectAllowed='move';}}
           onDragOver={event=>{if(hotbarDrag.current!==null){event.preventDefault();event.dataTransfer.dropEffect='move';}}}
           onDrop={event=>{event.preventDefault();const from=hotbarDrag.current;hotbarDrag.current=null;if(from!==null&&event.dataTransfer.getData('application/x-linjian-hotbar')===String(from))client.current?.moveSlot(from,index);}}
           onDragEnd={()=>{hotbarDrag.current=null;client.current?.pauseControls();}} onClick={()=>client.current?.selectSlot(index)} title={itemDescription(item)||'空'} aria-label={'快捷栏 '+(index+1)+'：'+(entry?.name??'空')} aria-pressed={selected===index}>
           <kbd>{index+1}</kbd>{entry&&<><Icon name={entry.icon} size={32}/>{entry.kind==='resource'?<span className="slot-count">{itemCount(item,inventory)}</span>:null}</>}
       </button>;
   })}</nav>
  </div>
  {!!loaded&&state?.connected&&!map&&!room&&!backpack&&signId===null&&!menu&&<TouchControls client={client} useLabel={touchUseLabel}/>}
  </div>{backpack&&<InventoryPanel slots={slots} resources={inventory} selected={selected} onMove={(from,to)=>client.current?.moveSlot(from,to)} onQuickMove={from=>client.current?.quickMoveSlot(from)} onClose={()=>setBackpack(false)}/> }
  {signId&&<SignPanel key={signId} text={typeof sign?.text==='string'?sign.text:''} available={sign?.kind==='sign'} connectionError={state?.error} onSave={text=>client.current?.saveSign(signId,text)??Promise.resolve('连接中断，请重试')} onClose={closeSign}/>}
  {showConnectionError && <div className="connection-error" role="alert"><span>{state?.error}</span><button onClick={() => client.current?.retryConnection()}>重试</button></div>}
  {menu&&<div className="modal-backdrop" onClick={()=>setMenu(false)}><section className="room-panel pause-panel" role="dialog" aria-modal="true" aria-label="游戏菜单" onClick={event=>event.stopPropagation()} onKeyDown={event=>{
      event.stopPropagation();if(event.key==='Escape'){event.preventDefault();setMenu(false);}
      if(event.key==='Tab'){const fields=Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button')),first=fields[0],last=fields[fields.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}
  }}><header><h2>游戏菜单</h2><button className="close" onClick={()=>setMenu(false)} aria-label="关闭游戏菜单">×</button></header><div className="pause-actions"><button autoFocus onClick={()=>setMenu(false)}>继续游戏</button><button onClick={()=>client.current?.toggleSound()} aria-pressed={state?.sound??true}>声音 {state?.sound===false?'关':'开'}</button>{onTutorial&&<button onClick={()=>{setMenu(false);onTutorial();}}>重看新手引导</button>}{onExit&&<button onClick={leave}>返回主菜单</button>}</div></section></div>}
  {map && <div className="modal-backdrop" onClick={() => setMap(false)}><section className="map-panel" role="dialog" aria-modal="true" aria-label="世界地图" onClick={e => e.stopPropagation()}><header><h2>世界地图</h2><button className="close" onClick={() => setMap(false)} aria-label="关闭地图">×</button></header><canvas ref={mapCanvas} className="map-canvas"/><footer>{player&&sceneAt(player.x)!=='mine'&&<button onClick={()=>{setTrackCave(true);setMap(false);}}>标记矿洞</button>}<span>{player && sceneAt(player.x) === 'mine' ? '矿洞 · 96 × 96' : '512 × 512'}</span><span>固定世界</span></footer></section></div>}
  {room && <div className="modal-backdrop" onClick={() => setRoom(false)}><section className="room-panel" role="dialog" aria-modal="true" aria-label="多人房间" onClick={e => e.stopPropagation()}><header><h2>多人房间</h2><button className="close" onClick={() => setRoom(false)} aria-label="关闭房间菜单">×</button></header><div className="room-number"><span>{localWorld?'状态':'房间号'}</span><strong>{localWorld?'本机世界':state?.session?.room || '—'}</strong>{!localWorld&&<button onClick={async () => { if (state?.session) {
        try {
            await navigator.clipboard.writeText(state.session.room);
            showNotice('已复制');
        }
        catch {
            showNotice('请选中房间号复制');
        }
    } }}>复制</button>}</div><form onSubmit={async (e) => { e.preventDefault(); setTutorialStoppedAt(tutorialRun); await client.current?.connect('join', roomCode); if (client.current?.connected)
        setRoom(false); }}><input autoFocus aria-label="房间号" placeholder="输入房间号" value={roomCode} onChange={e => setRoomCode(e.target.value.toUpperCase())} maxLength={8}/><button type="submit" disabled={roomCode.length !== 8}>加入</button></form>{state?.error && <p className="room-error">{state.error}</p>}<div className="room-footer"><span>{localWorld?(state.localSaved?'仅保存在此设备':'此设备无法保存'):count+' / 4'}</span><button onClick={async () => { setTutorialStoppedAt(tutorialRun); await client.current?.connect('create'); if (client.current?.connected)
        setRoom(false); }}>新建世界</button></div></section></div>}
 <LoadingScreen loading={loading} onRetry={()=>{void client.current?.retryConnection();}} onExit={leave}/>
 </main>;
}
