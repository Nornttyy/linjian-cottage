"use client";
import {useState,useSyncExternalStore} from 'react';
import Game from './Game';
import MainMenu,{type StartMode} from './MainMenu';
import {savedSession} from '@/lib/tutorial';
const sessionRoom=()=>{try{return savedSession(localStorage.getItem('linjian-session'))?.room??null;}catch{return null;}};
const serverRoom=()=>null;
const subscribeSession=(changed:()=>void)=>{
    const listener=(event:StorageEvent)=>{if(event.key==='linjian-session'||event.key===null)changed();};
    window.addEventListener('storage',listener);return()=>window.removeEventListener('storage',listener);
};
export default function GameShell({apiUrl='/api/game'}:{apiUrl?:string}){
    const [launch,setLaunch]=useState<{mode:StartMode;room:string}|null>(null),[tutorialRun,setTutorialRun]=useState(0);
    const savedRoom=useSyncExternalStore(subscribeSession,sessionRoom,serverRoom);
    if(!launch)return <MainMenu savedRoom={savedRoom} onStart={(mode,room='',tutorial=false)=>{setTutorialRun(tutorial?1:0);setLaunch({mode,room});}}/>;
    return <Game apiUrl={apiUrl} startMode={launch.mode} initialRoom={launch.room} tutorialRun={tutorialRun} onExit={()=>setLaunch(null)} onTutorial={()=>setTutorialRun(value=>value+1)}/>;
}
