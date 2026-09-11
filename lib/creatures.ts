export type CreatureKind='slime'|'boar'|'bat'|'mushroom';
export const CREATURES:Record<CreatureKind,{name:string;hp:number;speed:number;damage:number;windup:number;cooldown:number;range:number;reach:number;reward:number}>={
    slime:{name:'史莱姆',hp:54,speed:1.7,damage:14,windup:650,cooldown:1100,range:1.2,reach:1.65,reward:2},
    boar:{name:'林地野猪',hp:90,speed:1.7,damage:22,windup:800,cooldown:1700,range:4,reach:1.2,reward:4},
    bat:{name:'洞穴蝙蝠',hp:36,speed:2.8,damage:9,windup:420,cooldown:850,range:1.4,reach:1.8,reward:2},
    mushroom:{name:'蘑菇怪',hp:66,speed:.8,damage:16,windup:950,cooldown:1900,range:4.2,reach:1.45,reward:3},
};
export const CREATURE_SPAWNS:[CreatureKind,number,number][]=[
    ['boar',226,304],['boar',212,293],['boar',244,359],['boar',308,350],['boar',219,337],
    ['mushroom',237,289],['mushroom',208,316],['mushroom',170,399],['mushroom',304,272],['mushroom',687,60],
    ['bat',680,73],['bat',696,58],['bat',657,42],['bat',704,35],['bat',685,18],
];
