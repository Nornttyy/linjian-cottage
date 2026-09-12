"use client";
import {useEffect,useRef,useState,type PointerEvent as ReactPointerEvent,type RefObject} from 'react';
import type {GameClient} from '@/lib/client';
import {clampTouchStick,touchMoveKeys,type TouchMoveKey} from '@/lib/touch';

const MOVE_KEYS:TouchMoveKey[]=['w','a','s','d'];

export default function TouchControls({client,useLabel}:{client:RefObject<GameClient|null>;useLabel:string}){
    const pad=useRef<HTMLButtonElement>(null),movePointer=useRef<number|null>(null),usePointer=useRef<number|null>(null),pressed=useRef(new Set<TouchMoveKey>());
    const [stick,setStick]=useState({x:0,y:0}),[using,setUsing]=useState(false);
    const setMovement=(next:TouchMoveKey[])=>{
        const wanted=new Set(next),game=client.current;
        for(const key of MOVE_KEYS)if(wanted.has(key)!==pressed.current.has(key))game?.press(key,wanted.has(key));
        pressed.current=wanted;
    };
    const releaseMovement=(pointerId?:number)=>{
        if(pointerId!==undefined&&movePointer.current!==pointerId)return;
        setMovement([]);movePointer.current=null;setStick({x:0,y:0});
    };
    const updateMovement=(event:ReactPointerEvent<HTMLButtonElement>)=>{
        if(movePointer.current!==event.pointerId||!pad.current)return;
        event.preventDefault();
        const box=pad.current.getBoundingClientRect(),radius=Math.max(1,Math.min(box.width,box.height)/2-23);
        const point=clampTouchStick(event.clientX-(box.left+box.width/2),event.clientY-(box.top+box.height/2),radius);
        setStick(point);setMovement(touchMoveKeys(point.x,point.y,radius));
    };
    const stopUsing=(pointerId?:number)=>{
        if(pointerId!==undefined&&usePointer.current!==pointerId)return;
        client.current?.stopTouchUse(pointerId);usePointer.current=null;setUsing(false);
    };
    useEffect(()=>{
        const mountedClient=client.current;
        const release=()=>{for(const key of MOVE_KEYS)if(pressed.current.has(key))client.current?.press(key,false);pressed.current.clear();movePointer.current=null;usePointer.current=null;client.current?.stopTouchUse();setStick({x:0,y:0});setUsing(false);};
        const hidden=()=>{if(document.hidden)release();};
        window.addEventListener('blur',release);window.addEventListener('resize',release);window.addEventListener('orientationchange',release);window.addEventListener('pagehide',release);document.addEventListener('visibilitychange',hidden);
        return()=>{window.removeEventListener('blur',release);window.removeEventListener('resize',release);window.removeEventListener('orientationchange',release);window.removeEventListener('pagehide',release);document.removeEventListener('visibilitychange',hidden);for(const key of MOVE_KEYS)if(pressed.current.has(key))mountedClient?.press(key,false);pressed.current.clear();movePointer.current=null;usePointer.current=null;mountedClient?.stopTouchUse();};
    },[client]);
    return <div className="touch-controls" aria-label="触屏控制">
        <button ref={pad} type="button" className="touch-stick" aria-label="移动摇杆"
            onPointerDown={event=>{if(movePointer.current!==null)return;movePointer.current=event.pointerId;event.currentTarget.setPointerCapture?.(event.pointerId);updateMovement(event);}}
            onPointerMove={updateMovement}
            onPointerUp={event=>releaseMovement(event.pointerId)}
            onPointerCancel={event=>releaseMovement(event.pointerId)}
            onLostPointerCapture={event=>releaseMovement(event.pointerId)}>
            <i style={{transform:`translate(${stick.x}px,${stick.y}px)`}}/>
        </button>
        <div className="touch-actions" role="group" aria-label="动作按钮">
            <button type="button" className="touch-dodge" onPointerDown={event=>{event.preventDefault();client.current?.command({type:'dodge'});}}>闪避</button>
            <button type="button" className="touch-interact" onPointerDown={event=>{event.preventDefault();client.current?.interact();}}>交互</button>
            <button type="button" className={'touch-use'+(using?' is-active':'')} aria-label={useLabel}
                onPointerDown={event=>{if(usePointer.current!==null)return;event.preventDefault();event.currentTarget.setPointerCapture?.(event.pointerId);if(client.current?.startTouchUse(event.pointerId)){usePointer.current=event.pointerId;setUsing(true);}}}
                onPointerUp={event=>stopUsing(event.pointerId)}
                onPointerCancel={event=>stopUsing(event.pointerId)}
                onLostPointerCapture={event=>stopUsing(event.pointerId)}>{useLabel}</button>
        </div>
    </div>;
}
