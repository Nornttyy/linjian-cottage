export type TouchMoveKey='w'|'a'|'s'|'d';

export function touchMoveKeys(dx:number,dy:number,radius=1):TouchMoveKey[]{
    const length=Math.hypot(dx,dy),deadZone=Math.max(1,radius)*.2;
    if(length<deadZone)return[];
    const x=dx/length,y=dy/length,keys:TouchMoveKey[]=[];
    if(y<-.38)keys.push('w');
    if(x<-.38)keys.push('a');
    if(y>.38)keys.push('s');
    if(x>.38)keys.push('d');
    return keys;
}

export function clampTouchStick(dx:number,dy:number,radius:number){
    const length=Math.hypot(dx,dy);
    if(!length||length<=radius)return{x:dx,y:dy};
    const scale=radius/length;
    return{x:dx*scale,y:dy*scale};
}
