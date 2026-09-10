"use client";
import { useEffect, useRef, useState } from 'react';
import { GameClient, type ClientState } from '@/lib/client';
import Icon from './ItemIcon';
import InventoryPanel from './Inventory';
import {HOTBAR_SIZE,ITEMS,itemCount,itemDescription,visibleItem,defaultSlots} from '@/lib/inventory';
import { sceneAt } from '@/lib/world';
import { paintMap, regionAt } from '@/lib/renderer';

export default function Game({ apiUrl = '/api/game' }: { apiUrl?: string }) {
    const canvas = useRef<HTMLCanvasElement>(null), mapCanvas = useRef<HTMLCanvasElement>(null), client = useRef<GameClient | null>(null), noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [state, setState] = useState<ClientState | null>(null), [map, setMap] = useState(false), [room, setRoom] = useState(false), [backpack,setBackpack]=useState(false), [roomCode, setRoomCode] = useState(''), [notice, setNotice] = useState('');
    const showNotice = (text: string) => { setNotice(text); if (noticeTimer.current)
        clearTimeout(noticeTimer.current); noticeTimer.current = setTimeout(() => setNotice(''), 1400); };
    useEffect(() => { const game = new GameClient(canvas.current!, setState, showNotice, () => {setMap(v => !v);setRoom(false);setBackpack(false);}, apiUrl, () => {setBackpack(v=>!v);setMap(false);setRoom(false);}); client.current = game; game.connect(); return () => { game.destroy(); if (noticeTimer.current)
        clearTimeout(noticeTimer.current); }; }, [apiUrl]);
    useEffect(() => { if (client.current) {
        client.current.paused = map || room || backpack;
        client.current.pauseControls();
    } }, [map, room, backpack]);
    useEffect(() => { if (map && mapCanvas.current && state?.session)
        paintMap(mapCanvas.current, state.world, state.session.playerId); }, [map, state]);
    useEffect(() => { const close = (e: KeyboardEvent) => { if(e.key==='Escape'){setMap(false);setRoom(false);setBackpack(false);} }; window.addEventListener('keydown',close); return () => window.removeEventListener('keydown',close); }, []);
    const player = state?.session ? state.world.players[state.session.playerId] : undefined, inventory = player?.inventory;
    const slots=state?.slots??defaultSlots(),selected=state?.selectedSlot??0,activeItem=visibleItem(slots[selected],inventory);
    const openBackpack=()=>{client.current?.pauseControls();setBackpack(true);setMap(false);setRoom(false);};
    const count = state ? Object.values(state.world.players).filter(p => state.world.tick - p.seen < 15000).length : 0;
    return <main className="game-shell"><div className="game-view" inert={map||room||backpack}>
  <canvas ref={canvas} className="world-canvas" aria-label="游戏场景：WASD 移动，鼠标使用物品，1至9或滚轮切换快捷栏，E 背包，F 开关门，空格闪避"/>
  <header className="hud-top"><div className="identity"><h1>林间小筑</h1><span className={'connection-dot ' + (state?.connected ? 'online' : '')} title={state?.connected ? '已连接并保存' : '连接中'}/></div>
   <div className="region-label">{player ? regionAt(player.x, player.y) : '林间营地'}</div>
   <div className="top-actions"><button onClick={openBackpack} title="背包 · E">背包 <kbd>E</kbd></button><button onClick={() => setMap(true)} title="世界地图 · M">地图 <kbd>M</kbd></button><button onClick={() => setRoom(true)} title="多人房间">联机 <span>{count}/4</span></button></div>
  </header>
  <section className="vitals" aria-label="角色状态"><div className="health-row"><Icon name="heart" size={16}/><div className="meter health-meter" role="progressbar" aria-label="生命" aria-valuenow={Math.round(player?.hp || 0)} aria-valuemax={100}><i style={{ width: (player?.hp || 0) + '%' }}/></div><span>{Math.round(player?.hp || 0)}</span></div><div className="stamina-row"><Icon name="stamina" size={14}/><div className="meter stamina-meter" role="progressbar" aria-label="体力" aria-valuenow={Math.round(player?.stamina || 0)} aria-valuemax={100}><i style={{ width: (player?.stamina || 0) + '%' }}/></div></div></section>
  <div className="bottom-controls">
   {notice && <div className="notice" role="status">{notice}</div>}
   {activeItem&&<div className="selected-item-name">{state?.remove?'拆除':ITEMS[activeItem].name}</div>}
   <nav className="hotbar minecraft-hotbar" aria-label="九格快捷栏" onWheel={event=>{if(event.deltaY&&!event.ctrlKey)client.current?.selectSlot((selected+(event.deltaY>0?1:-1)+HOTBAR_SIZE)%HOTBAR_SIZE);}}>{slots.slice(0,HOTBAR_SIZE).map((slot,index)=>{
       const item=visibleItem(slot,inventory),entry=item?ITEMS[item]:null;
       return <button key={index} className={selected===index?'selected':''} onClick={()=>client.current?.selectSlot(index)} title={itemDescription(item)||'空'} aria-label={'快捷栏 '+(index+1)+'：'+(entry?.name??'空')} aria-pressed={selected===index}>
           <kbd>{index+1}</kbd>{entry&&<><Icon name={entry.icon} size={32}/>{entry.kind==='resource'?<span className="slot-count">{itemCount(item,inventory)}</span>:entry.kind==='plan'?<span className="slot-plan">建</span>:null}</>}
       </button>;
   })}</nav>
  </div>
  <div className="touch-controls"><div className="dpad">{[['w', 'up'], ['a', 'left'], ['s', 'down'], ['d', 'right']].map(([key, dir]) => <button key={key} className={'direction ' + dir} aria-label={dir} onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); client.current?.press(key, true); }} onPointerUp={() => client.current?.press(key, false)} onPointerCancel={() => client.current?.press(key, false)}><i /></button>)}</div><button className="dodge-button" onPointerDown={() => client.current?.command({ type: 'dodge' })}>闪避</button><button className="door-button" onClick={() => client.current?.command({ type: 'interact' })}>门</button></div>
  </div>{backpack&&<InventoryPanel slots={slots} resources={inventory} selected={selected} onMove={(from,to)=>client.current?.moveSlot(from,to)} onQuickMove={from=>client.current?.quickMoveSlot(from)} onClose={()=>setBackpack(false)}/> }
  {state?.error && !room && !backpack && <div className="connection-error" role="alert"><span>{state.error}</span><button onClick={() => client.current?.connect('resume')}>重试</button></div>}
  {map && <div className="modal-backdrop" onClick={() => setMap(false)}><section className="map-panel" role="dialog" aria-modal="true" aria-label="世界地图" onClick={e => e.stopPropagation()}><header><h2>世界地图</h2><button className="close" onClick={() => setMap(false)} aria-label="关闭地图">×</button></header><canvas ref={mapCanvas} className="map-canvas"/><footer><span>{player && sceneAt(player.x) === 'mine' ? '矿洞 · 96 × 96' : '512 × 512'}</span><span>固定世界</span></footer></section></div>}
  {room && <div className="modal-backdrop" onClick={() => setRoom(false)}><section className="room-panel" role="dialog" aria-modal="true" aria-label="多人房间" onClick={e => e.stopPropagation()}><header><h2>多人房间</h2><button className="close" onClick={() => setRoom(false)} aria-label="关闭房间菜单">×</button></header><div className="room-number"><span>房间号</span><strong>{state?.session?.room || '—'}</strong><button onClick={async () => { if (state?.session) {
        try {
            await navigator.clipboard.writeText(state.session.room);
            showNotice('已复制');
        }
        catch {
            showNotice('请选中房间号复制');
        }
    } }}>复制</button></div><form onSubmit={async (e) => { e.preventDefault(); await client.current?.connect('join', roomCode); if (client.current?.connected)
        setRoom(false); }}><input autoFocus aria-label="房间号" placeholder="输入房间号" value={roomCode} onChange={e => setRoomCode(e.target.value.toUpperCase())} maxLength={8}/><button type="submit" disabled={roomCode.length !== 8}>加入</button></form>{state?.error && <p className="room-error">{state.error}</p>}<div className="room-footer"><span>{count} / 4</span><button onClick={async () => { await client.current?.connect('create'); if (client.current?.connected)
        setRoom(false); }}>新建世界</button></div></section></div>}
 </main>;
}
