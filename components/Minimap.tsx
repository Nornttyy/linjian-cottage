"use client";
import {useEffect,useRef,type RefObject} from 'react';
import type {GameClient} from '@/lib/client';
import {paintMinimap} from '@/lib/minimap';
import {sceneAt,MINE} from '@/lib/world';
import {floorLevel} from '@/lib/structures';

export default function Minimap({client,hidden=false,onOpen}:{client:RefObject<GameClient|null>;hidden?:boolean;onOpen:()=>void}){
    const canvas=useRef<HTMLCanvasElement>(null),place=useRef<HTMLSpanElement>(null),coordinates=useRef<HTMLSpanElement>(null);
    useEffect(()=>{
        if(hidden)return;
        const draw=()=>{
            const game=client.current;if(document.hidden||!canvas.current||!game?.connected||!game.session)return;
            paintMinimap(canvas.current,game.world,game.session.playerId,game.pos,game.art);
            const mine=sceneAt(game.pos.x)==='mine',level=floorLevel(game.pos),label=mine?'矿洞':level?`${level+1} 层`:'地表';
            const position=`${Math.floor(game.pos.x-(mine?MINE.x:0))}, ${Math.floor(game.pos.y)}`;
            if(place.current&&place.current.textContent!==label)place.current.textContent=label;
            if(coordinates.current&&coordinates.current.textContent!==position)coordinates.current.textContent=position;
        };
        draw();const timer=setInterval(draw,100);return()=>clearInterval(timer);
    },[client,hidden]);
    if(hidden)return null;
    return <button className="minimap" onClick={onOpen} title="附近地图 · M" aria-label="小地图，点击打开完整地图">
        <span className="minimap-heading"><b>N</b><span ref={place}/><kbd>M</kbd></span><canvas ref={canvas} width={320} height={320} aria-hidden="true"/><span className="minimap-position" ref={coordinates}/>
    </button>;
}
