import type {HeroAction} from './art';
import {FEMALE_PICK_LAYOUT} from './female-pick-layout';
export type FemaleSheet={file:string;action:HeroAction;base?:string;rowEdges?:readonly number[];registration?:{frames:number[][];anchors:number[][]}};
// Hair-to-sole measurements of the female standing poses, in down/up/right
// order. Each whole action keeps one scale, including crouches and raised tools.
export const FEMALE_BODY_HEIGHTS:Record<HeroAction,readonly number[]>={
    walk:[225,224,227],idle:[226,224,234],hurt:[227,226,236],
    axe:[213,211,220],pick:[217,217,210],sword:[220,213,215],
    hammer:[208,213,225],hoe:[217,199,219],water:[222,222,243],
    plant:[216,217,237],harvest:[212,232,230],pickup:[225,231,225],
    eat:[217,231,227],fish:[215,227,218],cook:[215,227,223],
    sleep:[219,219,200],dodge:[213,223,222],
};
export type DyeRegistration={scale:number;x:number;y:number;revised?:boolean};
// Maps resized female watering frames to the reviewed tool exclusion mask.
export const femaleDyeRegistrations=new WeakMap<HTMLCanvasElement,DyeRegistration>();
export const FEMALE_SHEETS:readonly FemaleSheet[]=[
    {file:'female-walk-v3.png',action:'walk',base:'hero-walk-v2.png'},
    {file:'female-idle-v3.png',action:'idle'},
    {file:'female-hurt-v3.png',action:'hurt'},
    {file:'female-axe-v3.png',action:'axe',base:'hero-axe-v3.png',rowEdges:[0,273,520,768]},
    {file:'female-pick-v3.png',action:'pick',registration:FEMALE_PICK_LAYOUT},
    {file:'female-sword-v3.png',action:'sword',base:'hero-sword-v3.png'},
    ...(['hammer','hoe','water','plant','harvest','pickup','eat','fish','cook','sleep'] as const).map(action=>({file:`female-${action}-v3.png`,action,base:`hero-${action}.png`})),
    {file:'female-roll-v3.png',action:'dodge',base:'hero-roll.png'},
];
