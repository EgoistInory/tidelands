// Pure local input planning on a copied observation; never imports browser APIs or mutates the running game.
import {createWorld,LANDMARKS,terrain} from '../src/world.js';
import {actorBlocksMove} from '../src/actor-contact.js';
import {resourceBlocksMove,resourceReachDistance} from '../src/resource-contact.js';
import {footprintBlocksMove} from '../src/resource-footprint.js';
import {ruinBlocksMove} from '../src/ruin-layout.js';
export const world=createWorld();
const cells=new Map(),cellSize=16;
for(const o of world.objects){const k=`${Math.floor(o.x/cellSize)},${Math.floor(o.z/cellSize)}`;if(!cells.has(k))cells.set(k,[]);cells.get(k).push(o);}
const nearby=p=>{const found=[];for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)found.push(...(cells.get(`${Math.floor(p.x/cellSize)+dx},${Math.floor(p.z/cellSize)+dz}`)??[]));return found;};
export function clearSegment(state,from,to){
  const distance=Math.hypot(to.x-from.x,to.z-from.z),steps=Math.max(1,Math.ceil(distance/.45));let a={...from};
  for(let i=1;i<=steps;i++){
    const b={x:from.x+(to.x-from.x)*i/steps,z:from.z+(to.z-from.z)*i/steps};
    if(Math.abs(b.x)>390||Math.abs(b.z)>390||terrain(b.x,b.z)-terrain(a.x,a.z)>1.9)return false;
    if(nearby(b).some(o=>(state.depleted[o.id]??0)<=state.time&&(footprintBlocksMove(a,b,o,.35)??(o.type==='tree'?actorBlocksMove(a,b,o,.35,1.15):resourceBlocksMove(a,b,o,.35)))))return false;
    if(state.buildings.some(o=>o.type!=='campfire'&&actorBlocksMove(a,b,o,.35,1.65)))return false;
    if(LANDMARKS.some(o=>o.type==='ruin'?ruinBlocksMove(a,b,o):o.type==='npc'?actorBlocksMove(a,b,o):['cottage','lighthouse'].includes(o.type)&&actorBlocksMove(a,b,o,.35,o.type==='cottage'?3.65:2.65)))return false;
    if(state.enemies.some(o=>o.hp>0&&actorBlocksMove(a,b,o)))return false;a=b;
  }return true;
}
const heapPush=(heap,item)=>{heap.push(item);for(let i=heap.length-1;i>0;){const p=(i-1)>>1;if(heap[p].f<=item.f)break;heap[i]=heap[p];heap[p]=item;i=p;}};
const heapPop=heap=>{const first=heap[0],last=heap.pop();if(heap.length){heap[0]=last;for(let i=0;;){let c=i*2+1;if(c>=heap.length)break;if(c+1<heap.length&&heap[c+1].f<heap[c].f)c++;if(heap[c].f>=last.f)break;heap[i]=heap[c];heap[c]=last;i=c;}}return first;};
const resourceTypes=['tree','stone','crystal','berry','fiber','shell'];
export function reached(state,target){return resourceTypes.includes(target.type)?resourceReachDistance(state.player,target)<2.72:Math.hypot(state.player.x-target.x,state.player.z-target.z)<(target.type==='lighthouse'?5:3.2);}
export function plan(state,target){
  if(reached(state,target))return {reached:true,path:[]};
  const origin={x:state.player.x,z:state.player.z},yaw=state.requestedYaw,cs=Math.cos(yaw),sn=Math.sin(yaw),spacing=1.5;
  const point=(x,z)=>({x:origin.x+spacing*(x*cs+z*sn),z:origin.z+spacing*(-x*sn+z*cs)});
  const nodes=new Map(),heap=[],start={x:0,z:0,g:0,f:Math.hypot(origin.x-target.x,origin.z-target.z),parent:null};nodes.set('0,0',start);heapPush(heap,start);let visited=0;
  while(heap.length&&visited<35000){
    const node=heapPop(heap);if(node.closed)continue;node.closed=true;visited++;const p=point(node.x,node.z);
    if(reached({...state,player:p},target)){
      const path=[];for(let n=node;n.parent;n=n.parent)path.unshift({...point(n.x,n.z),key:n.key});return {reached:false,path,visited};
    }
    for(const [dx,dz,key] of [[0,-1,'w'],[1,0,'d'],[0,1,'s'],[-1,0,'a']]){
      const x=node.x+dx,z=node.z+dz,tag=`${x},${z}`,old=nodes.get(tag);if(old?.closed)continue;const q=point(x,z);if(!clearSegment(state,p,q))continue;
      const cost=node.g+spacing*(terrain(q.x,q.z)<.15?1.4:1),f=cost+Math.hypot(q.x-target.x,q.z-target.z);
      if(old&&old.g<=cost)continue;const next={x,z,g:cost,f,key,parent:node,closed:false};nodes.set(tag,next);heapPush(heap,next);
    }
  }return {reached:false,path:[],visited,error:'No route within budget'};
}
export function nextInput(state,target){
  const route=plan(state,target);if(route.reached||!route.path.length)return route;
  const key=route.path[0].key;let end=route.path[0];for(const p of route.path.slice(1)){if(p.key!==key)break;end=p;if(Math.hypot(p.x-state.player.x,p.z-state.player.z)>8)break;}
  const distance=Math.hypot(end.x-state.player.x,end.z-state.player.z),speed=terrain(state.player.x,state.player.z)<.15?5:7;
  return {...route,key,durationMs:Math.max(60,Math.min(1100,Math.round((distance/speed-.06)*1000))),distance};
}
