"use client";
import {useState} from 'react';
import type {Inventory as Resources} from '@/lib/simulation';
import {HOTBAR_SIZE,ITEMS,itemCount,itemDescription,visibleItem,type ItemSlot} from '@/lib/inventory';
import Icon from './ItemIcon';

export default function Inventory({slots,resources,selected,onMove,onQuickMove,onClose}:{
    slots:ItemSlot[];resources?:Resources;selected:number;
    onMove:(from:number,to:number)=>void;onQuickMove:(from:number)=>void;onClose:()=>void;
}){
    const [picked,setPicked]=useState<number|null>(null),[hovered,setHovered]=useState<number|null>(null);
    const itemAt=(index:number)=>visibleItem(slots[index],resources);
    const description=itemDescription(itemAt(hovered??picked??selected));
    const slot=(index:number)=>{
        const item=itemAt(index),entry=item?ITEMS[item]:null,count=itemCount(item,resources);
        return <button key={index} className={'inventory-slot'+(picked===index?' picked':'')+(index===selected?' active-slot':'')}
            aria-label={(index<HOTBAR_SIZE?'快捷栏 '+(index+1):'背包 '+(index-HOTBAR_SIZE+1))+'：'+(entry?entry.name+(entry.kind==='resource'?' '+count:''):'空')}
            title={itemDescription(item)} draggable={!!item}
            onMouseEnter={()=>setHovered(index)} onMouseLeave={()=>setHovered(null)} onFocus={()=>setHovered(index)}
            onClick={event=>{if(event.shiftKey&&item){onQuickMove(index);setPicked(null);}else if(picked!==null){if(picked!==index)onMove(picked,index);setPicked(null);}else if(item)setPicked(index);}}
            onKeyDown={event=>{if(/^[1-9]$/.test(event.key)){event.preventDefault();event.stopPropagation();onMove(index,Number(event.key)-1);setPicked(null);}}}
            onDragStart={event=>{event.dataTransfer.setData('text/plain',String(index));event.dataTransfer.effectAllowed='move';setPicked(index);}}
            onDragOver={event=>{event.preventDefault();event.dataTransfer.dropEffect='move';}}
            onDrop={event=>{event.preventDefault();const value=event.dataTransfer.getData('text/plain');if(/^\d+$/.test(value)){const source=Number(value);if(source<slots.length)onMove(source,index);}setPicked(null);}}
            onDragEnd={()=>setPicked(null)}>
            {index<HOTBAR_SIZE&&<kbd>{index+1}</kbd>}
            {entry&&<><Icon name={entry.icon} size={32}/>{entry.kind==='resource'?<span className="slot-count">{count}</span>:entry.kind==='plan'?<span className="slot-plan">建</span>:null}</>}
        </button>;
    };
    return <div className="modal-backdrop" onClick={onClose}><section className="inventory-panel" role="dialog" aria-modal="true" aria-label="背包" onClick={event=>event.stopPropagation()}>
        <header><h2>背包</h2><button autoFocus className="close" onClick={onClose} aria-label="关闭背包">×</button></header>
        <div className="inventory-grid" aria-label="背包格子">{slots.slice(HOTBAR_SIZE).map((_,i)=>slot(i+HOTBAR_SIZE))}</div>
        <div className="inventory-divider"><span>快捷栏</span><kbd>1 — 9</kbd></div>
        <div className="inventory-grid inventory-hotbar" aria-label="背包内快捷栏">{slots.slice(0,HOTBAR_SIZE).map((_,i)=>slot(i))}</div>
        <div className="inventory-description" aria-live="polite">{description||' '}</div>
        <footer><span>拖动整理 · Shift 快速移动</span><kbd>E / Esc</kbd></footer>
    </section></div>;
}
