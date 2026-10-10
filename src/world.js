export const WORLD_SIZE = 800;
export const SPAWN = {x:-70,z:102};
export const ISLANDS = [
  {x:-90,z:5,r:155,h:25,name:'潮汐海岸',color:0x789b50},
  {x:160,z:-95,r:128,h:37,name:'苍翠林地',color:0x52825b},
  {x:-75,z:-235,r:100,h:48,name:'雾岬高地',color:0x7c8979},
  {x:145,z:180,r:90,h:20,name:'琥珀浅滩',color:0xb4ab67}
];
export const LANDMARKS = [
  {id:'keeper',type:'npc',name:'守灯人 · 阿岚',x:-59,z:94,color:0xe1ae62},
  {id:'botanist',type:'npc',name:'药草师 · 林栖',x:132,z:-26,color:0x8ead76},
  {id:'explorer',type:'npc',name:'航海家 · 远舟',x:-70,z:-190,color:0x7295ab},
  {id:'lighthouse',type:'lighthouse',name:'归航灯塔',x:-93,z:-54},
  {id:'cottage',type:'cottage',name:'守灯人的家',x:-46,z:78},
  {id:'ruin',type:'ruin',name:'雾岬遗迹',x:-88,z:-267}
];
export function randomGenerator(seed=72191){return()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);}
export function terrain(x,z){
  let value=-5;
  for(const island of ISLANDS){
    const dx=x-island.x,dz=z-island.z;
    const warped=Math.hypot(dx,dz)+(Math.sin(x*.035+z*.022)*9+Math.sin(z*.067)*4);
    const t=Math.max(0,1-warped/island.r);
    value=Math.max(value,Math.pow(t,.92)*island.h-3+Math.sin(x*.075)*Math.cos(z*.061)*Math.min(t*9,2.7));
  }
  return value;
}
export function regionAt(x,z){
  if(terrain(x,z)<0)return '群岛海域';
  return [...ISLANDS].sort((a,b)=>Math.hypot(x-a.x,z-a.z)/a.r-Math.hypot(x-b.x,z-b.z)/b.r)[0].name;
}
export function dayCycle(time){
  const phase=((time%480)+480)%480/480;
  const label=phase<.2||phase>=.8?'夜晚':phase<.32?'清晨':phase<.68?'午后':'黄昏';
  const daylight=Math.max(.04,Math.min(1,Math.sin((phase-.25)*Math.PI*2)*.85+.15));
  return {label,daylight,day:Math.floor(time/480)+1};
}
export function createWorld(){
  const random=randomGenerator(),objects=[];
  for(let i=0;i<1800;i++){
    const x=random()*760-380,z=random()*760-380,y=terrain(x,z);
    if(y<.8||LANDMARKS.some(o=>Math.hypot(x-o.x,z-o.z)<10)||Math.hypot(x-SPAWN.x,z-SPAWN.z)<8)continue;
    const r=random(),type=y>22&&r>.50?'crystal':y<2.6?'shell':r<.47?'tree':r<.74?'stone':r<.90?'berry':'fiber';
    objects.push({id:`resource-${i}`,type,x,z,y,scale:.7+random()*.9,rotation:random()*Math.PI*2});
  }
  // A legible first loop around spawn, independent of world density.
  [['tree',-73,91],['stone',-81,101],['berry',-64,110],['fiber',-82,91],['tree',-92,101],['stone',-67,118]].forEach(([type,x,z],i)=>objects.push({id:`starter-${i}`,type,x,z,y:terrain(x,z),scale:1,rotation:i}));
  const enemies=[];
  for(let i=0;i<80;i++){
    const island=ISLANDS[i%4],angle=random()*Math.PI*2,r=island.r*(.38+random()*.4),x=island.x+Math.cos(angle)*r,z=island.z+Math.sin(angle)*r;
    if(terrain(x,z)>.3&&Math.hypot(x-SPAWN.x,z-SPAWN.z)>30)enemies.push({id:`enemy-${i}`,type:i%3===0?'boar':'crab',x,z,hp:i%3===0?70:40,homeX:x,homeZ:z});
  }
  return {objects,enemies};
}
