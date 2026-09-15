export const RESPAWN_DELAY_MS=1800;
export type DeathState={at:number;x:number;y:number;level:number;face:'down'|'up'|'left'|'right';cause:string};
export function deathPose(death:DeathState,time:number){
    const age=Math.max(0,time-death.at),phase=Math.min(5,Math.floor(age/130));
    return{angle:[0,.12,.35,.7,1.15,Math.PI/2][phase]*(death.face==='left'?-1:1),sink:Math.min(4,Math.floor(age/160)),frame:Math.min(7,Math.floor(age/90)),ready:age>=RESPAWN_DELAY_MS};
}
