import {SPAWN,LANDMARKS,terrain,regionAt,createWorld} from './world.js';
import {ATTACK_DURATION,ATTACK_IMPACT,GATHER_DURATION,GATHER_IMPACT} from './action-timing.js';
export const ITEMS={wood:'木材',stone:'石料',fiber:'纤维',berry:'浆果',shell:'贝壳',crystal:'晶石',axe:'石斧',sword:'晶石剑',meal:'烤浆果'};
export const RECIPES={axe:{name:'石斧',cost:{wood:4,stone:3},description:'提高采集数量和攻击伤害'},meal:{name:'烤浆果',cost:{berry:3},description:'恢复 45 点生命'},sword:{name:'晶石剑',cost:{wood:4,stone:4,crystal:3},description:'伤害提升至 38'},campfire:{name:'营火',cost:{wood:5,stone:3},description:'靠近按 E 休息，恢复生命'},tent:{name:'帐篷',cost:{wood:8,fiber:5},description:'设置重生点，恢复体力'},workbench:{name:'工作台',cost:{wood:8,stone:5},description:'解锁晶石剑制作'}};
export const QUESTS=[
  {title:'归航的灯火',text:'与海边的守灯人交谈',hint:'靠近人物，按 E 交谈'},
  {title:'荒野的第一把工具',text:'采集 4 木材和 3 石料，制作石斧',hint:'E 采集 · C 打开制作'},
  {title:'在岛上安一个家',text:'建造一堆营火',hint:'采集 5 木材和 3 石料，按 C 制作'},
  {title:'林间的来信',text:'前往苍翠林地，寻找药草师林栖',hint:'M 查看地图；可以游泳穿越海峡'},
  {title:'雾岬的回声',text:'击败 2 只野兽，再与雾岬的航海家交谈',hint:'空格攻击 · 浆果能恢复生命'},
  {title:'让灯塔重新发光',text:'携带 12 木材、8 石料和 3 晶石修复灯塔',hint:'晶石出现在高地；回到潮汐海岸的灯塔'},
  {title:'群岛，再次相连',text:'灯火已经点亮。整个群岛等待你的探索。',hint:'可以继续建造、制作与自由探索'}
];
export function freshGame(){const world=createWorld();return {version:1,player:{...SPAWN,hp:100,stamina:100,yaw:0},inventory:{wood:0,stone:0,fiber:0,berry:3,shell:0,crystal:0,axe:0,sword:0,meal:0},buildings:[],depleted:{},enemies:world.enemies,quest:0,kills:0,time:120,respawn:{...SPAWN},discovered:['潮汐海岸'],selected:'hand',attackAt:-100,interactAt:-100};}
export function affordable(state,cost){return Object.entries(cost).every(([k,n])=>(state.inventory[k]||0)>=n);}
function spend(state,cost){for(const [k,n]of Object.entries(cost))state.inventory[k]-=n;}
export function craft(state,key){const recipe=RECIPES[key];if(!recipe)return '没有这个配方。';if(!affordable(state,recipe.cost))return '材料不足，去附近探索一下吧。';
  if(key==='sword'&&!state.buildings.some(b=>b.type==='workbench'))return '需要先建造工作台。';
  if(['axe','sword'].includes(key)&&state.inventory[key])return '你已经拥有这件工具。';
  if(['campfire','tent','workbench'].includes(key))return 'place';
  spend(state,recipe.cost);state.inventory[key]=(state.inventory[key]||0)+1;if(['axe','sword'].includes(key))state.selected=key;if(key==='axe'&&state.quest===1)state.quest=2;
  return `制作完成：${recipe.name}`;
}
export function canBuild(state,objects,key,x,z){
  if(!['campfire','tent','workbench'].includes(key))return '未知建筑。';
  if(!affordable(state,RECIPES[key].cost))return '建筑材料不足。';
  if(Math.hypot(x-state.player.x,z-state.player.z)>9)return '请靠近建造位置。';
  const h=terrain(x,z);if(h<1)return '不能建在水里或潮间带。';
  if(Math.abs(terrain(x+2,z)-terrain(x-2,z))+Math.abs(terrain(x,z+2)-terrain(x,z-2))>3)return '这里太陡，换一块平地吧。';
  if(state.buildings.some(b=>Math.hypot(x-b.x,z-b.z)<6)||LANDMARKS.some(b=>Math.hypot(x-b.x,z-b.z)<7))return '与现有建筑或人物太近。';
  if(objects.some(o=>['tree','stone','crystal'].includes(o.type)&&!isDepleted(state,o)&&Math.hypot(x-o.x,z-o.z)<3))return '这里被树木或岩石占据。';
  return '';
}
export function build(state,objects,key,x,z){const error=canBuild(state,objects,key,x,z);if(error)return error;spend(state,RECIPES[key].cost);state.buildings.push({id:`built-${state.buildings.length}-${Math.floor(state.time*100)}`,type:key,x,z});if(key==='campfire'&&state.quest===2)state.quest=3;if(key==='tent')state.respawn={x,z:z+4};return `建造完成：${RECIPES[key].name}`;}
export function isDepleted(state,object){return (state.depleted[object.id]||0)>state.time;}
export function interact(state,object,{defer=false}={}){if(!object)return '靠近树木、石头、植物或人物后按 E。';if(state.time-state.interactAt<.45)return '';state.interactAt=state.time;
  if(object.type==='npc'){
    if(object.id==='keeper'){if(state.quest===6)return '阿岚：归航灯塔又亮起来了。谢谢你，旅人。海上的人有了回家的方向。';if(state.quest===0)state.quest=1;return '阿岚：风暴熄灭了归航灯塔。先采些木材和石料，做一把石斧，我们会需要它。';}
    if(object.id==='botanist'){
      if(state.quest<3)return '林栖：先完成海岸上阿岚的委托，做一把石斧，再建起营火。安顿好营地后，我们再谈雾岬的事。';
      if(state.quest===3){state.quest=4;state.inventory.berry+=5;return '林栖：雾岬高地上有能点亮灯塔的晶石。野兽守着山路，击退两只，再去找航海家远舟。送你一些浆果。';}
      if(state.quest===6)return '林栖：我看见灯塔的光了。归航的船有了方向，多谢你，旅人。';
      return state.quest===4?'林栖：去雾岬击退两只野兽，再找远舟。他知道怎样修复归航灯塔。':'林栖：带齐 12 木材、8 石料和 3 晶石，回海岸修复灯塔吧。';
    }
    if(object.id==='explorer'){if(state.quest===6)return '远舟：灯塔已经点亮，船队可以安心归航了。旅人，群岛还有许多地方等着你探索。';if(state.quest===4&&state.kills>=2){state.quest=5;state.inventory.crystal+=1;return '远舟：你已经能独自穿过荒野了。这块晶石送给你；带齐材料，回去修复灯塔吧。';}return state.quest<4?'远舟：先去苍翠林地找林栖，她知道雾岬的秘密。':state.kills<2?'远舟：先击退两只野兽，证明山路已经安全。':'远舟：灯塔需要 12 木材、8 石料和 3 晶石。';}
  }
  if(object.type==='lighthouse'){if(state.quest===5&&affordable(state,{wood:12,stone:8,crystal:3})){spend(state,{wood:12,stone:8,crystal:3});state.quest=6;return '灯塔亮了！远处传来船鸣，群岛再次相连。主线已完成，可以继续自由探索。';}return state.quest===6?'归航的灯火长明。谢谢你，旅人。':'修复灯塔需要先完成岛民的委托，并准备 12 木材、8 石料、3 晶石。';}
  if(['campfire','tent'].includes(object.type)){state.player.hp=100;state.player.stamina=100;if(object.type==='tent')state.respawn={x:object.x,z:object.z+4};return object.type==='tent'?'你休息片刻，已将这里设为重生点。':'火光驱散疲惫，生命和体力已恢复。';}
  if(object.type==='workbench')return '工作台已就绪。按 C 可以制作晶石剑。';
  if(object.type==='cottage')return '门口挂着一盏小灯。守灯人正在海边等你。';
  if(object.type==='ruin')return '石碑上刻着：群岛不因海峡而分离，只因灯火而相连。';
  if(isDepleted(state,object))return '这里的资源还在恢复。';
  const item={tree:'wood',stone:'stone',fiber:'fiber',berry:'berry',shell:'shell',crystal:'crystal'}[object.type];if(!item)return '';
  const count=['wood','stone'].includes(item)?(state.inventory.axe?3:2):item==='crystal'?1:2;
  if(defer){if(terrain(state.player.x,state.player.z)<.15)return '请先靠岸，再采集附近资源。';return {message:'',pending:{state,at:state.time,object:{id:object.id,x:object.x,z:object.z},item,count,resolved:false}};}
  return applyGather(state,object,item,count);
}
export function resolveGather(state,pending){
  if(!pending||pending.state!==state||pending.resolved||pending.at!==state.interactAt||state.time<pending.at+GATHER_IMPACT||state.time>=pending.at+GATHER_DURATION)return null;
  pending.resolved=true;
  if(terrain(state.player.x,state.player.z)<.15)return '请先靠岸，再采集附近资源。';
  if(Math.hypot(pending.object.x-state.player.x,pending.object.z-state.player.z)>=7)return '离资源太远，靠近后再采集。';
  if(isDepleted(state,pending.object))return '这里的资源还在恢复。';
  return applyGather(state,pending.object,pending.item,pending.count);
}
function applyGather(state,object,item,count){
  state.inventory[item]+=count;state.depleted[object.id]=state.time+150;
  return `${ITEMS[item]} +${count}`;
}
export function eat(state){const key=state.inventory.meal?'meal':state.inventory.berry?'berry':null;if(!key)return '没有食物，去采些浆果吧。';if(state.player.hp>=100)return '现在生命是满的，先留着食物吧。';state.inventory[key]--;state.player.hp=Math.min(100,state.player.hp+(key==='meal'?45:18));return `吃掉${ITEMS[key]}，恢复生命。`;}
export function attack(state,{defer=false}={}){
  if(state.time-state.attackAt<.6)return {message:'',hits:[]};
  state.attackAt=state.time;
  const damage=state.selected==='sword'&&state.inventory.sword?38:state.selected==='axe'&&state.inventory.axe?23:12;
  if(defer)return {message:'',hits:[],pending:{state,at:state.time,damage,resolved:false}};
  return applyAttackDamage(state,damage);
}
export function resolveAttack(state,pending){
  if(!pending||pending.state!==state||pending.resolved||pending.at!==state.attackAt||state.time<pending.at+ATTACK_IMPACT||state.time>=pending.at+ATTACK_DURATION)return null;
  pending.resolved=true;return applyAttackDamage(state,pending.damage);
}
function applyAttackDamage(state,damage){const hits=[];
  for(const e of state.enemies){if(e.hp<=0||Math.hypot(e.x-state.player.x,e.z-state.player.z)>5.2)continue;e.hp-=damage;hits.push(e.id);if(e.hp<=0){state.kills++;state.inventory.fiber+=2;state.inventory.berry++;}}
  return {message:hits.length?`命中 ${hits.length} 个目标${state.kills?' · 累计击败 '+state.kills:''}`:'',hits};
}
export function movePlayer(state,objects,dx,dz,dt,running=false){
  const p=state.player,length=Math.hypot(dx,dz);if(length<.01)return;
  const swimming=terrain(p.x,p.z)<.15,sprint=running&&!swimming&&p.stamina>2,speed=swimming?5:sprint?12:7;
  if(sprint)p.stamina=Math.max(0,p.stamina-dt*17);
  dx=dx/length*speed*dt;dz=dz/length*speed*dt;p.yaw=Math.atan2(dx,dz);
  const allowed=(x,z)=>{if(Math.abs(x)>390||Math.abs(z)>390)return false;const old=terrain(p.x,p.z),next=terrain(x,z);if(next-old>1.9)return false;
    if(objects.some(o=>o.type==='tree'&&!isDepleted(state,o)&&Math.hypot(x-o.x,z-o.z)<1.5))return false;
    if(state.buildings.some(o=>o.type!=='campfire'&&Math.hypot(x-o.x,z-o.z)<2))return false;
    return !LANDMARKS.some(o=>['cottage','lighthouse'].includes(o.type)&&Math.hypot(x-o.x,z-o.z)<(o.type==='cottage'?4:3));};
  if(allowed(p.x+dx,p.z))p.x+=dx;if(allowed(p.x,p.z+dz))p.z+=dz;
  const region=regionAt(p.x,p.z);if(!state.discovered.includes(region))state.discovered.push(region);
}
export function tick(state,dt,running=false,feedback=null){if(feedback){feedback.damage=0;feedback.respawned=false;}state.time+=dt;if(!running)state.player.stamina=Math.min(100,state.player.stamina+dt*11);let message='';
  for(const e of state.enemies){if(e.hp<=0)continue;const distance=Math.hypot(e.x-state.player.x,e.z-state.player.z);if(distance<15&&distance>2.3){const speed=e.type==='boar'?4.2:2.5,nx=e.x+(state.player.x-e.x)/distance*speed*dt,nz=e.z+(state.player.z-e.z)/distance*speed*dt;if(terrain(nx,nz)>.3){e.x=nx;e.z=nz;}}
    if(distance<2.9&&state.time>=(state.protectedUntil||0)&&state.time-(e.attackAt||0)>1.3){const damage=Math.min(state.player.hp,e.type==='boar'?12:7);state.player.hp-=damage;if(feedback)feedback.damage+=damage;e.attackAt=state.time;message='受到攻击！空格反击，或拉开距离。';}}
  if(state.player.hp<=0){if(feedback)feedback.respawned=true;Object.assign(state.player,state.respawn,{hp:100,stamina:100});state.protectedUntil=state.time+8;message='你在营地醒来。背包已保留，获得 8 秒保护，趁现在重新出发吧。';}
  return message;
}
export function nearest(state,objects){const options=[...LANDMARKS,...state.buildings,...objects.filter(o=>!isDepleted(state,o))];let best=null,d=7;for(const o of options){const dist=Math.hypot(o.x-state.player.x,o.z-state.player.z);if(dist<d){d=dist;best=o;}}return best;}
export function nearestEnemy(state){let best=null,d=15;for(const e of state.enemies){if(e.hp<=0)continue;const distance=Math.hypot(e.x-state.player.x,e.z-state.player.z);if(distance<d){d=distance;best=e;}}return best;}
export function serialize(state){return JSON.stringify(state);}
export function restore(raw){const v=JSON.parse(raw);const fresh=freshGame();
  if(v?.version!==1||!v.player||!['x','z','hp','stamina','yaw'].every(k=>Number.isFinite(v.player[k]))||Math.abs(v.player.x)>390||Math.abs(v.player.z)>390||v.player.hp<0||v.player.hp>100||v.player.stamina<0||v.player.stamina>100)throw new Error('存档角色数据无效');
  if(!Number.isInteger(v.quest)||v.quest<0||v.quest>6||!Number.isFinite(v.time)||v.time<0||!Number.isSafeInteger(v.kills)||v.kills<0)throw new Error('存档进度无效');
  if(!v.inventory||Object.keys(ITEMS).some(k=>!Number.isSafeInteger(v.inventory[k])||v.inventory[k]<0))throw new Error('存档背包数据无效');
  if(!Array.isArray(v.buildings)||v.buildings.length>500||v.buildings.some(b=>!b||!['campfire','tent','workbench'].includes(b.type)||!Number.isFinite(b.x)||!Number.isFinite(b.z)||Math.abs(b.x)>390||Math.abs(b.z)>390||typeof b.id!=='string'||b.id.length===0||b.id.length>128)||new Set(v.buildings.map(b=>b.id)).size!==v.buildings.length)throw new Error('存档建筑数据无效');
  if(!v.depleted||Array.isArray(v.depleted)||typeof v.depleted!=='object'||Object.entries(v.depleted).some(([k,n])=>!/^resource-\d+$|^starter-\d+$/.test(k)||!Number.isFinite(n)||n<0))throw new Error('存档资源数据无效');
  if(!Array.isArray(v.enemies)||v.enemies.length!==fresh.enemies.length||v.enemies.some((e,i)=>!e||e.id!==fresh.enemies[i].id||!['crab','boar'].includes(e.type)||!['x','z','hp'].every(k=>Number.isFinite(e[k]))||Math.abs(e.x)>390||Math.abs(e.z)>390||e.hp>100))throw new Error('存档生物数据无效');
  if(!v.respawn||!Number.isFinite(v.respawn.x)||!Number.isFinite(v.respawn.z)||Math.abs(v.respawn.x)>390||Math.abs(v.respawn.z)>390)throw new Error('存档营地数据无效');
  return {...fresh,...v,enemies:v.enemies.map(e=>({...e,attackAt:Number.isFinite(e.attackAt)?Math.max(0,Math.min(v.time,e.attackAt)):0})),selected:['axe','sword'].includes(v.selected)&&v.inventory[v.selected]>0?v.selected:'hand',protectedUntil:Number.isFinite(v.protectedUntil)?Math.max(0,Math.min(v.time+8,v.protectedUntil)):0,attackAt:-100,interactAt:-100,discovered:Array.isArray(v.discovered)?v.discovered.filter(x=>typeof x==='string').slice(0,10):fresh.discovered};
}
