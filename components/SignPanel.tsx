"use client";
import {useState} from 'react';
import {SIGN_TEXT_LIMIT,normalizeSignText} from '@/lib/structures';

export default function SignPanel({text,available=true,connectionError,onSave,onClose}:{
    text:string;available?:boolean;connectionError?:string;
    onSave:(text:string)=>Promise<string|null>;onClose:()=>void;
}){
    const [editing,setEditing]=useState(false),[draft,setDraft]=useState(text),[saving,setSaving]=useState(false),[error,setError]=useState('');
    const count=Array.from(draft).length;
    const save=async()=>{
        if(saving||!available||count>SIGN_TEXT_LIMIT)return;
        setSaving(true);setError('');
        try{const message=await onSave(draft);if(message)setError(message);else setEditing(false);}
        catch{setError('保存失败，请重试');}
        finally{setSaving(false);}
    };
    return <div className="modal-backdrop" onClick={onClose}><section className="room-panel sign-panel" role="dialog" aria-modal="true" aria-labelledby="sign-title" onClick={event=>event.stopPropagation()}
        onKeyDown={event=>{
            event.stopPropagation();
            if(event.key==='Escape'){event.preventDefault();onClose();}
            if(event.key==='Tab'){
                const fields=Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),textarea:not(:disabled)'));
                const first=fields[0],last=fields[fields.length-1];
                if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
                else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
            }
        }}>
        <header><h2 id="sign-title">告示牌</h2><button autoFocus className="close" onClick={onClose} aria-label="关闭告示牌">×</button></header>
        {!available&&<p role="alert">告示牌已移除</p>}
        {editing?<form onSubmit={event=>{event.preventDefault();void save();}}>
            <textarea autoFocus aria-label="告示牌内容" value={draft} disabled={saving||!available} rows={7} onChange={event=>setDraft(normalizeSignText(event.target.value))}/>
            <div className="sign-count" aria-live="polite">{count} / {SIGN_TEXT_LIMIT}</div>
            {count>SIGN_TEXT_LIMIT&&<p role="alert">最多240字</p>}
            {(error||saving&&connectionError)&&<p role="alert">{error||'连接中断，正在重试'}</p>}
            <footer><button type="button" disabled={saving} onClick={()=>{setEditing(false);setError('');}}>取消</button><button type="submit" disabled={saving||!available||count>SIGN_TEXT_LIMIT}>{saving?'保存中…':'保存'}</button></footer>
        </form>:<><p className="sign-content">{text||'还没有内容'}</p><footer><button onClick={onClose}>关闭</button><button disabled={!available} onClick={()=>{setDraft(text);setError('');setEditing(true);}}>编辑</button></footer></>}
    </section></div>;
}
