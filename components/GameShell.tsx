"use client";
import {useState,useSyncExternalStore} from 'react';
import Game from './Game';
import MainMenu,{type StartMode} from './MainMenu';
import {activeCharacter,characterSession,CHARACTER_KEY} from '@/lib/characters';
const sessionRoom=()=>{try{return characterSession(activeCharacter()?.id)?.room??null;}catch{return null;}};
const serverRoom=()=>null;
const subscribeSession=(changed:()=>void)=>{
    const listener=(event:StorageEvent)=>{if(event.key==='linjian-session'||event.key===CHARACTER_KEY||event.key?.startsWith('linjian-character-session:')||event.key===null)changed();};
    window.addEventListener('storage',listener);window.addEventListener('linjian-characters-changed',changed);return()=>{window.removeEventListener('storage',listener);window.removeEventListener('linjian-characters-changed',changed);};
};
export default function GameShell({apiUrl='/api/game'}:{apiUrl?:string}){
    const [launch,setLaunch]=useState<{mode:StartMode;room:string;characterId?:string;characterName?:string}|null>(null),[tutorialRun,setTutorialRun]=useState(0);
    const savedRoom=useSyncExternalStore(subscribeSession,sessionRoom,serverRoom);
    if(!launch)return <MainMenu savedRoom={savedRoom} onStart={(mode,room='',tutorial=false)=>{setTutorialRun(tutorial?1:0);const hero=activeCharacter();setLaunch({mode,room,characterId:hero?.id,characterName:hero?.name});}}/>;
    return <Game characterId={launch.characterId} characterName={launch.characterName} apiUrl={apiUrl} startMode={launch.mode} initialRoom={launch.room} tutorialRun={tutorialRun} onExit={()=>setLaunch(null)} onTutorial={()=>setTutorialRun(value=>value+1)}/>;
}
