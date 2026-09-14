"use client";
import {useState,useSyncExternalStore} from 'react';
import type {Appearance} from '@/lib/appearance';
import Game from './Game';
import CharacterMenu from './CharacterMenu';
import MainMenu,{type StartMode} from './MainMenu';
import {continuableSession,characterSession,importLegacyCharacter,CHARACTER_KEY} from '@/lib/characters';
const sessionRoom=()=>{try{return continuableSession()?.room??null;}catch{return null;}};
const serverRoom=()=>null;
const subscribeSession=(changed:()=>void)=>{
    const listener=(event:StorageEvent)=>{if(event.key==='linjian-session'||event.key===CHARACTER_KEY||event.key?.startsWith('linjian-character-session:')||event.key===null)changed();};
    window.addEventListener('storage',listener);window.addEventListener('linjian-characters-changed',changed);return()=>{window.removeEventListener('storage',listener);window.removeEventListener('linjian-characters-changed',changed);};
};
export default function GameShell({apiUrl='/api/game'}:{apiUrl?:string}){
    const [launch,setLaunch]=useState<{mode:StartMode;room:string;characterId?:string;characterName?:string;appearance?:Appearance}|null>(null),[tutorialRun,setTutorialRun]=useState(0);
    const [pending,setPending]=useState<{mode:StartMode;room:string;tutorial:boolean;error?:string}|null>(null);
    const savedRoom=useSyncExternalStore(subscribeSession,sessionRoom,serverRoom);
    if(pending)return <CharacterMenu mode={pending.mode} initialError={pending.error} onBack={()=>setPending(null)} onChoose={(hero,newWorld)=>{
        const mode=pending.mode==='resume'&&newWorld&&!characterSession(hero.id)?'create':pending.mode;
        if(mode==='resume'&&!characterSession(hero.id))return;
        setTutorialRun(pending.tutorial?1:0);setLaunch({mode,room:mode===pending.mode?pending.room:'',characterId:hero.id,characterName:hero.name,appearance:hero.appearance});setPending(null);
    }}/>;
    if(!launch)return <MainMenu savedRoom={savedRoom} onStart={(mode,room='',tutorial=false)=>{
        let error;try{importLegacyCharacter();}catch{error='此设备暂时无法保存角色。';}
        setPending({mode,room,tutorial,error});
    }}/>;
    return <Game appearance={launch.appearance} characterId={launch.characterId} characterName={launch.characterName} apiUrl={apiUrl} startMode={launch.mode} initialRoom={launch.room} tutorialRun={tutorialRun} onExit={()=>setLaunch(null)} onTutorial={()=>setTutorialRun(value=>value+1)}/>;
}
