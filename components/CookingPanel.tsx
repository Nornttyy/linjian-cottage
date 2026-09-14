"use client";
import {useState} from 'react';
import type {WorldState,Player} from '@/lib/simulation';
import {COOK_METHODS,DISHES,DISH_IDS,INGREDIENTS,INGREDIENT_IDS,MAX_COOKING_INGREDIENTS,ingredientCounts,knownRecipes,resolveRecipe,validateSelection,type ResolvedRecipe,type CookMethod,type IngredientId} from '@/lib/cooking';
import {PANTRY_OFFERS,type PantryOffer} from '@/lib/pantry';
import {ITEMS} from '@/lib/inventory';
import {nearCampfire} from '@/lib/activities';
import Icon from './ItemIcon';

type Props={player:Player;buildings?:WorldState['buildings'];busy:boolean;supported:boolean;connected:boolean;onClose:()=>void;onCook:(method:CookMethod,ingredients:IngredientId[])=>boolean;onPantry:(offer:PantryOffer)=>boolean};
export default function CookingPanel({player,buildings,busy,supported,connected,onClose,onCook,onPantry}:Props){
    const [method,setMethod]=useState<CookMethod>('roast'),[ingredients,setIngredients]=useState<IngredientId[]>([]),[tab,setTab]=useState<'cook'|'recipes'|'pantry'>('cook');
    const [previousResult]=useState(player.cookingResult?.id),[clearedResult,setClearedResult]=useState(player.cookingResult?.id);
    if(player.cookingResult&&player.cookingResult.id!==clearedResult){setClearedResult(player.cookingResult.id);setIngredients([]);}
    const inventory=player.inventory,counts=ingredientCounts(ingredients),recipe=resolveRecipe(method,ingredients),selection=validateSelection(ingredients,inventory);
    const near=nearCampfire(player,buildings),disabled=busy||!connected||!near||!supported;
    const result=player.cookingResult&&player.cookingResult.id!==previousResult?player.cookingResult:null;
    const available=INGREDIENT_IDS.filter(id=>(inventory[id]??0)>0);
    const add=(id:IngredientId)=>{if(!disabled&&ingredients.length<MAX_COOKING_INGREDIENTS&&(counts[id]??0)<(inventory[id]??0))setIngredients([...ingredients,id]);};
    const discovered=knownRecipes(player),known=recipe&&discovered.some(entry=>entry.key===recipe.key);
    const chooseRecipe=(recipe:ResolvedRecipe)=>{setMethod(recipe.method);setIngredients([...recipe.ingredients]);setTab('cook');};
    return <div className="modal-backdrop cooking-backdrop" onClick={onClose}><section className="cooking-panel" role="dialog" aria-modal="true" aria-labelledby="cooking-title" onClick={event=>event.stopPropagation()} onKeyDown={event=>{
        event.stopPropagation();if(event.key==='Escape'){event.preventDefault();onClose();}
        if(event.key==='Tab'){const buttons=Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')),first=buttons[0],last=buttons[buttons.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}
    }}>
        <header className="cooking-header"><div><span>营地厨房</span><h2 id="cooking-title">今天想吃什么</h2></div><button autoFocus className="close" onClick={onClose} aria-label="关闭烹饪">×</button></header>
        {!supported?<div className="cooking-unavailable"><p>这个多人房间尚未支持新版料理。</p><p>主菜单的“本机世界”已可体验。</p></div>:<>
        <nav className="kitchen-tabs" aria-label="厨房页面">{([['cook','料理'],['recipes','食谱'],['pantry','食材补给']] as const).map(([id,name])=><button key={id} onClick={()=>setTab(id)} aria-pressed={tab===id}>{name}</button>)}</nav>
        {tab!=='pantry'&&<nav className="cooking-methods" aria-label="料理做法">{(Object.keys(COOK_METHODS) as CookMethod[]).map(id=><button key={id} onClick={()=>setMethod(id)} disabled={busy} aria-pressed={method===id}>{COOK_METHODS[id].name}</button>)}</nav>}
        <div className="kitchen-content">
        {tab==='cook'&&<>
            <div className="cooking-slots-header"><span>加入食材</span><span>{ingredients.length} / 5</span></div>
            <div className="cooking-slots" aria-label="五个食材槽">{Array.from({length:5},(_,i)=>{
                const item=ingredients[i];return <button key={i} className={item?'filled':''} disabled={!item||disabled} title={item?'取回'+INGREDIENTS[item].name:'空食材槽'} aria-label={`食材槽${i+1}：${item?INGREDIENTS[item].name:'空'}`} onClick={()=>setIngredients(ingredients.filter((_,index)=>index!==i))}>
                    {item?<><Icon name={ITEMS[item].icon} size={34}/><span>{INGREDIENTS[item].name}</span></>:<span className="slot-number">{i+1}</span>}
                </button>;
            })}</div>
            <section className="recipe-preview" aria-live="polite" aria-label="料理预览">
                <div className="recipe-dish">{known&&recipe&&<Icon name={recipe.id} size={48}/>}<div><strong>{recipe?(known?DISHES[recipe.id].name:'新的搭配，试着做做看'):ingredients.length?'这项做法还需要主食材':'选择食材和做法'}</strong><span>{recipe?(known?`制作 ${recipe.quantity} 份 · 生命+${recipe.hp} · 体力+${recipe.stamina}`:'做出成品后，记录食谱和恢复效果'):ingredients.length?'试试鱼虾、蔬菜、肉、蛋或谷物':'搭配 1～5 份，乱搭也会做出奇葩料理'}</span></div></div>
                <button className="cook-submit" disabled={disabled||!recipe||!selection.ok} onClick={()=>onCook(method,ingredients)}>{busy?'制作中…':COOK_METHODS[method].verb}</button>
            </section>
            {ingredients.length>0&&!selection.ok&&<p className="kitchen-status" role="status">{selection.error}</p>}
            <p className="pantry-intro">食材与做法要合拍；种子、材料和剩菜也能试着入锅。奇怪的搭配通常恢复很少。</p>
            <div className="ingredients-header"><h3>背包食材</h3><button disabled={disabled||!ingredients.length} onClick={()=>setIngredients([])}>全部取回</button></div>
            <div className="ingredient-grid">{available.map(id=>{const left=(inventory[id]??0)-(counts[id]??0);return <button key={id} disabled={disabled||left<=0||ingredients.length>=5} onClick={()=>add(id)} title={INGREDIENTS[id].name} aria-label={`加入${INGREDIENTS[id].name}，剩余${Math.max(0,left)}份`}><Icon name={ITEMS[id].icon} size={30}/><span>{INGREDIENTS[id].name}</span><b>{Math.max(0,left)}</b></button>;})}</div>
            {!available.length&&<div className="empty-ingredients"><p>钓鱼、种田，或在营地换些食材。</p><button onClick={()=>setTab('pantry')}>查看食材补给</button></div>}
        </>}
        {tab==='recipes'&&<><p className="pantry-intro">已发现 {new Set(discovered.map(entry=>entry.id)).size} / {DISH_IDS.length} 道料理 · {discovered.length} 种搭配。做出新搭配后会自动记录。</p><div className="recipe-book">{discovered.filter(entry=>entry.method===method).map(entry=>{
            const owned=validateSelection(entry.ingredients,inventory).ok;
            return <button className="recipe-card" key={entry.key} disabled={disabled} onClick={()=>chooseRecipe(entry)} aria-label={'选择'+DISHES[entry.id].name+'配方'}><Icon name={entry.id} size={40}/><div><strong>{DISHES[entry.id].name}</strong><span>{Object.entries(entry.counts).map(([item,count])=>INGREDIENTS[item as IngredientId].name+'×'+count).join(' · ')}</span><span>每份生命+{entry.hp} · 体力+{entry.stamina} · 产出{entry.quantity}份</span><small>{owned?'材料齐全':'可以选入，再准备食材'}</small></div></button>;
        })}</div>{!discovered.some(entry=>entry.method===method)&&<p className="empty-ingredients">这一页还没有记录。自由尝试，做出第一道料理吧。</p>}</>}
        {tab==='pantry'&&<>
            <p className="pantry-intro">用采集的材料，换取野营食材。</p>
            <div className="pantry-grid">{(Object.keys(PANTRY_OFFERS) as PantryOffer[]).map(id=>{const offer=PANTRY_OFFERS[id],costs=Object.entries(offer.cost) as ['wood'|'essence',number][],enough=costs.every(([item,count])=>inventory[item]>=count);return <article key={id} className="pantry-card"><Icon name={id} size={36}/><div><strong>{INGREDIENTS[id].name} ×{offer.quantity}</strong><span>{costs.map(([item,count])=>`${ITEMS[item].name} ${count} / ${inventory[item]}`).join(' · ')}</span></div><button disabled={disabled||!enough} onClick={()=>onPantry(id)}>兑换</button></article>;})}</div>
            <p className="pantry-source">三文鱼在河流中出没；往南走到河口，还能钓到金枪鱼、甜虾和海胆。</p>
        </>}
        </div>
        <footer className="kitchen-footer" aria-live="polite">{!connected?'连接中断，正在重连':!near?'请回到营火旁继续制作':busy?'正在准备料理…':result?`${DISHES[result.dish].name} ×${result.quantity} 已放入背包${result.discovered?' · 新搭配已记入食谱':''}`:'关闭窗口后，可在快捷栏食用料理'}</footer>
        </>}
    </section></div>;
}
