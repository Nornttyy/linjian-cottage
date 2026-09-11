import {canBuild,type Player,type WorldState,type Part} from './simulation';
import {atLevel,floorLevel} from './structures';

export function buildGuide(state:WorldState,player:Player,target:{x:number;y:number},part:Part,remove:boolean){
    const {x,y}=target,level=floorLevel(player),width=!remove&&part==='stairs'?2:1;
    const existing=atLevel(state.buildings,x,y,'roof',level)??atLevel(state.buildings,x,y,'stairs',level)??atLevel(state.buildings,x,y,'wall',level)??atLevel(state.buildings,x,y,'floor',level);
    const reason=remove?(Math.hypot(player.x-x-.5,player.y-y-.5)>5?'距离太远':existing?null:'这里没有构件'):canBuild(state,player,x,y,part);
    return{x,y,width,height:width,valid:reason===null,reason,roof:remove&&existing?.kind==='roof'};
}

export function drawBuildGrid(ctx:CanvasRenderingContext2D,ox:number,oy:number,width:number,height:number){
    ctx.save();ctx.strokeStyle='#f7efc540';ctx.lineWidth=.5;ctx.beginPath();
    const left=((ox%24)+24)%24,top=((oy%24)+24)%24;
    for(let x=left;x<=width;x+=24){ctx.moveTo(x+.25,0);ctx.lineTo(x+.25,height);}
    for(let y=top;y<=height;y+=24){ctx.moveTo(0,y+.25);ctx.lineTo(width,y+.25);}
    ctx.stroke();ctx.restore();
}

export function drawBuildTarget(ctx:CanvasRenderingContext2D,guide:ReturnType<typeof buildGuide>,ox:number,oy:number){
    const x=guide.x*24+ox,y=guide.y*24+oy-(guide.roof?22:0),width=guide.width*24,height=guide.height*24;
    ctx.save();ctx.fillStyle=guide.valid?'#f8edaa20':'#dc72522d';ctx.fillRect(x,y,width,height);
    ctx.strokeStyle=guide.valid?'#fff1ac':'#e3916e';ctx.lineWidth=1;ctx.strokeRect(x+.5,y+.5,width-1,height-1);
    if(guide.width>1){ctx.setLineDash([2,2]);ctx.lineWidth=.5;ctx.beginPath();ctx.moveTo(x+24,y);ctx.lineTo(x+24,y+height);ctx.moveTo(x,y+24);ctx.lineTo(x+width,y+24);ctx.stroke();}
    ctx.restore();
}
