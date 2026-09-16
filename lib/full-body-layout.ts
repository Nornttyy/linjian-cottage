import type {Appearance} from './appearance';
import type {HeroAction,Direction} from './art';

export const BODY_FAMILIES=['swim','mushroom','moth','snow','moss'] as const;
export type BodyFamily=typeof BODY_FAMILIES[number];
export const BODY_ACTION_PAIRS=[['idle','walk'],['hurt','dodge'],['axe','pick'],['sword','hammer'],['hoe','water'],['plant','harvest'],['pickup','eat'],['fish','cook'],['sleep']] as const;
export const BODY_IDLE_POSES=[0,4,8,12,16,24,27,30] as const;
export const FULL_BODY_SHEETS=BODY_FAMILIES.flatMap(family=>BODY_ACTION_PAIRS.map(actions=>({family,actions,file:`body-${family}-${actions.join('-')}-v2.png`})));
export type FullBodySprite=`body-${BodyFamily}-${Appearance['body']}-${HeroAction}-${Direction}-${number}`;
export function bodyFamily(outfit:Appearance['outfit']):BodyFamily|undefined{
    if(outfit?.endsWith('-swim'))return 'swim';
    return BODY_FAMILIES.find(family=>outfit===`${family}-cloak`);
}
export function fullBodyKey(family:BodyFamily,body:Appearance['body'],frame:string):FullBodySprite{return `body-${family}-${body}-${frame}` as FullBodySprite;}
export function bodyIdlePose(frame:number){let pose=0;for(let i=1;i<BODY_IDLE_POSES.length;i++)if(frame>=BODY_IDLE_POSES[i])pose=i;return pose;}
