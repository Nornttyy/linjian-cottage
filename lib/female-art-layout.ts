import type {HeroAction} from './art';
export type FemaleSheet={file:string;action:HeroAction;base?:string};
export const FEMALE_SHEETS:readonly FemaleSheet[]=[
    {file:'female-walk-v1.png',action:'walk',base:'hero-walk-v2.png'},
    {file:'female-idle-v1.png',action:'idle'},
    {file:'female-hurt-v1.png',action:'hurt'},
    {file:'female-axe-v1.png',action:'axe',base:'hero-axe-v3.png'},
    {file:'female-pick-v1.png',action:'pick',base:'hero-pick-v3.png'},
    {file:'female-sword-v1.png',action:'sword',base:'hero-sword-v3.png'},
    ...(['hammer','hoe','water','plant','harvest','pickup','eat','fish','cook','sleep'] as const).map(action=>({file:`female-${action}-v1.png`,action,base:`hero-${action}.png`})),
    {file:'female-roll-v1.png',action:'dodge',base:'hero-roll.png'},
];
