import {normalizeAppearance,type Appearance} from './appearance';
import {savedSession} from './tutorial';
import type {Session} from './client';
export type Character={id:string;name:string;createdAt:number;appearance?:Appearance};
export type CharacterList={version:1;active:string;characters:Character[]};
export const CHARACTER_KEY='linjian-characters';
export const characterSessionKey=(id:string)=>'linjian-character-session:'+id;
const empty=():CharacterList=>({version:1,active:'',characters:[]});
export function readCharacters(raw:string|null):CharacterList{
    try{
        const value=JSON.parse(raw??'null');
        if(value?.version!==1||!Array.isArray(value.characters))return empty();
        const characters=value.characters.filter((p:Character)=>p&&typeof p.id==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(p.id)&&typeof p.name==='string'&&p.name.length<=16&&Number.isFinite(p.createdAt));
        return {version:1,active:characters.some((p:Character)=>p.id===value.active)?value.active:'',characters:characters.map((hero:Character)=>({...hero,appearance:normalizeAppearance(hero.appearance)}))};
    }catch{return empty();}
}
export const characterSnapshot=()=>{try{return localStorage.getItem(CHARACTER_KEY);}catch{return null;}};
export const serverCharacterSnapshot=()=>null;
export function subscribeCharacters(change:()=>void){
    const listener=(event:StorageEvent)=>{if(!event.key||event.key===CHARACTER_KEY||event.key.startsWith('linjian-character-session:'))change();};
    window.addEventListener('storage',listener);window.addEventListener('linjian-characters-changed',change);
    return()=>{window.removeEventListener('storage',listener);window.removeEventListener('linjian-characters-changed',change);};
}
export function activeCharacter(){const list=readCharacters(characterSnapshot());return list.characters.find(p=>p.id===list.active);}
export function characterSession(id?:string):Session|null{
    try{return savedSession(localStorage.getItem(id?characterSessionKey(id):'linjian-session'));}catch{return null;}
}
export function saveCharacterSession(session:Session,id?:string){
    if(id)localStorage.setItem(characterSessionKey(id),JSON.stringify(session));
    // The legacy pointer remains a fallback for older versions, never the source
    // of another character's world.
    localStorage.setItem('linjian-session',JSON.stringify(session));
}
function saveList(list:CharacterList){localStorage.setItem(CHARACTER_KEY,JSON.stringify(list));window.dispatchEvent(new Event('linjian-characters-changed'));}
export function createCharacter(name:string,appearance?:Appearance){
    const clean=name.trim().replace(/[\u0000-\u001f\u007f]/g,'').slice(0,16);if(!clean)throw Error('请填写角色名字');
    const list=readCharacters(characterSnapshot());
    // First opening preserves the old world as its own character.
    if(!list.characters.length){const legacy=characterSession();if(legacy){const hero={id:'legacy',name:'旅人',createdAt:Date.now()};localStorage.setItem(characterSessionKey(hero.id),JSON.stringify(legacy));list.characters.push(hero);}}
    const hero={id:crypto.randomUUID(),name:clean,createdAt:Date.now(),appearance:normalizeAppearance(appearance)};list.characters.push(hero);list.active=hero.id;saveList(list);return hero;
}
export function selectCharacter(id:string){
    const list=readCharacters(characterSnapshot());if(!list.characters.some(p=>p.id===id))throw Error('角色不存在');list.active=id;saveList(list);
}
export function importLegacyCharacter(){
    const list=readCharacters(characterSnapshot());if(list.characters.length)return;
    const legacy=characterSession();if(!legacy)return;
    const hero={id:'legacy',name:'旅人',createdAt:Date.now()};
    localStorage.setItem(characterSessionKey(hero.id),JSON.stringify(legacy));saveList({version:1,active:hero.id,characters:[hero]});
}
export function renameCharacter(id:string,name:string,appearance?:Appearance){
    const clean=name.trim().slice(0,16);if(!clean)throw Error('请填写角色名字');
    const list=readCharacters(characterSnapshot()),hero=list.characters.find(p=>p.id===id);if(!hero)throw Error('角色不存在');hero.name=clean;if(appearance)hero.appearance=normalizeAppearance(appearance);saveList(list);
}

export function continuableSession(){
    const list=readCharacters(characterSnapshot());
    const selected=list.active?characterSession(list.active):null;if(selected)return selected;
    for(const hero of list.characters){const session=characterSession(hero.id);if(session)return session;}
    return list.characters.length?null:characterSession();
}
