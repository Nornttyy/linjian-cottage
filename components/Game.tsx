"use client";
import { useEffect, useRef, useState } from 'react';
import { GameClient, type ClientState } from '@/lib/client';
import { loadArt, paintIcon } from '@/lib/art';
import { sceneAt } from '@/lib/world';
import { paintMap, regionAt } from '@/lib/renderer';
import { COSTS, PART_NAMES, type Part, type Tool } from '@/lib/simulation';
function Icon({ name, size = 28 }: {
    name: string;
    size?: number;
}) { const ref = useRef<HTMLCanvasElement>(null); useEffect(() => { let active = true; loadArt().then(art => { if (active && ref.current)
    paintIcon(ref.current.getContext('2d')!, name, art, 32); }); return () => { active = false; }; }, [name]); return <canvas className="item-icon" ref={ref} width={32} height={32} style={{ width: size, height: size }} aria-hidden="true"/>; }
export default function Game({ apiUrl = '/api/game' }: { apiUrl?: string }) {
    const canvas = useRef<HTMLCanvasElement>(null), mapCanvas = useRef<HTMLCanvasElement>(null), client = useRef<GameClient | null>(null), noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [state, setState] = useState<ClientState | null>(null), [map, setMap] = useState(false), [room, setRoom] = useState(false), [roomCode, setRoomCode] = useState(''), [notice, setNotice] = useState('');
    const showNotice = (text: string) => { setNotice(text); if (noticeTimer.current)
        clearTimeout(noticeTimer.current); noticeTimer.current = setTimeout(() => setNotice(''), 1400); };
    useEffect(() => { const game = new GameClient(canvas.current!, setState, showNotice, () => setMap(v => !v), apiUrl); client.current = game; game.connect(); return () => { game.destroy(); if (noticeTimer.current)
        clearTimeout(noticeTimer.current); }; }, [apiUrl]);
    useEffect(() => { if (client.current) {
        client.current.paused = map || room;
        client.current.keys.clear();
    } }, [map, room]);
    useEffect(() => { if (map && mapCanvas.current && state?.session)
        paintMap(mapCanvas.current, state.world, state.session.playerId); }, [map, state]);
    useEffect(() => { const close = (e: KeyboardEvent) => { if(e.key==='Escape'){setMap(false);setRoom(false);} }; window.addEventListener('keydown',close); return () => window.removeEventListener('keydown',close); }, []);
    const player = state?.session ? state.world.players[state.session.playerId] : undefined, inventory = player?.inventory;
    const choose = (tool: Tool) => client.current?.setTool(tool);
    const count = state ? Object.values(state.world.players).filter(p => state.world.tick - p.seen < 15000).length : 0;
    return <main className="game-shell">
  <canvas ref={canvas} className="world-canvas" aria-label="游戏场景：WASD 移动，鼠标采集或攻击，B 建造，空格闪避，E 开关门"/>
  <header className="hud-top"><div className="identity"><h1>林间小筑</h1><span className={'connection-dot ' + (state?.connected ? 'online' : '')} title={state?.connected ? '已连接并保存' : '连接中'}/></div>
   <div className="region-label">{player ? regionAt(player.x, player.y) : '林间营地'}</div>
   <div className="top-actions"><button onClick={() => setMap(true)} title="世界地图 · M">地图 <kbd>M</kbd></button><button onClick={() => setRoom(true)} title="多人房间">联机 <span>{count}/4</span></button></div>
  </header>
  <section className="vitals" aria-label="角色状态"><div className="health-row"><Icon name="heart" size={16}/><div className="meter health-meter" role="progressbar" aria-label="生命" aria-valuenow={Math.round(player?.hp || 0)} aria-valuemax={100}><i style={{ width: (player?.hp || 0) + '%' }}/></div><span>{Math.round(player?.hp || 0)}</span></div><div className="stamina-row"><Icon name="stamina" size={14}/><div className="meter stamina-meter" role="progressbar" aria-label="体力" aria-valuenow={Math.round(player?.stamina || 0)} aria-valuemax={100}><i style={{ width: (player?.stamina || 0) + '%' }}/></div></div></section>
  <aside className="resources" aria-label="背包资源">{(['wood', 'stone', 'copper', 'essence'] as const).map((key, i) => <div className="resource" key={key} title={['木材', '石头', '铜矿', '精华'][i]}>{key === 'essence' ? <button className="resource-use" onClick={() => client.current?.command({type:'heal'})} title="精华：回复生命 · R" aria-label="使用精华回复生命"><Icon name={key} size={23}/><span>{inventory?.[key] || 0}</span></button> : <><Icon name={key} size={23}/><span>{inventory?.[key] || 0}</span></>}</div>)}</aside>
  <div className="bottom-controls">
   {state?.tool === 'build' && <div className="build-palette" aria-label="建筑构件">{(['floor', 'wall', 'window', 'door', 'roof'] as Part[]).map(part => <button key={part} onClick={() => client.current?.setPart(part)} className={state.part === part && !state.remove ? 'selected' : ''} title={PART_NAMES[part]} aria-label={PART_NAMES[part]}><Icon name={part} size={29}/><span className="part-name">{PART_NAMES[part]}</span><span className="part-cost"><Icon name="wood" size={12}/>{COSTS[part].wood}{COSTS[part].stone ? <><Icon name="stone" size={12}/>{COSTS[part].stone}</> : null}</span></button>)}<button onClick={() => client.current?.toggleRemove()} className={state.remove ? 'selected remove-selected' : ''} title="拆除 · X" aria-label="拆除"><Icon name="remove" size={25}/><span className="part-name">拆除</span><kbd>X</kbd></button></div>}
   {notice && <div className="notice" role="status">{notice}</div>}
   <nav className="hotbar" aria-label="工具栏">{(['axe', 'pick', 'sword', 'build'] as Tool[]).map((tool, i) => <button key={tool} className={state?.tool === tool ? 'selected' : ''} onClick={() => choose(tool)} title={['斧头', '镐', '剑', '建造'][i]} aria-label={['斧头', '镐', '剑', '建造'][i]} aria-pressed={state?.tool === tool}><kbd>{i + 1}</kbd><Icon name={tool} size={32}/><span>{['斧', '镐', '剑', '建造'][i]}</span></button>)}</nav>
  </div>
  <div className="touch-controls"><div className="dpad">{[['w', 'up'], ['a', 'left'], ['s', 'down'], ['d', 'right']].map(([key, dir]) => <button key={key} className={'direction ' + dir} aria-label={dir} onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); client.current?.press(key, true); }} onPointerUp={() => client.current?.press(key, false)} onPointerCancel={() => client.current?.press(key, false)}><i /></button>)}</div><button className="dodge-button" onPointerDown={() => client.current?.command({ type: 'dodge' })}>闪避</button><button className="door-button" onClick={() => client.current?.command({ type: 'interact' })}>门</button></div>
  {state?.error && !room && <div className="connection-error" role="alert"><span>{state.error}</span><button onClick={() => client.current?.connect('resume')}>重试</button></div>}
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
