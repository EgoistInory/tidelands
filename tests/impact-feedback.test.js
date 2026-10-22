import test from 'node:test';
import assert from 'node:assert/strict';
import {freshGame,interact,resolveGather,attack,resolveAttack} from '../src/game.js';
import {gatherImpact,attackImpacts,createImpactFeedback} from '../src/impact-feedback.js';
import * as THREE from '../vendor/three.module.min.js';
import {WorldView} from '../src/scene.js';
import {createCreature} from '../src/creature.js';

test('resource feedback follows actual committed yield, never early, failed, cancelled or duplicate resolution',()=>{
 for(const reason of ['success','range','cancel','early']){
  const state=freshGame(),object={id:'feedback-stone',type:'stone',x:state.player.x+2,z:state.player.z},pending=interact(state,object,{defer:true}).pending;
  assert.equal(gatherImpact(state,pending,null),null);
  state.time+=reason==='early'?.1:.21;if(reason==='range')state.player.x+=10;if(reason==='cancel')state.interactAt=-100;
  const message=resolveGather(state,pending),cue=gatherImpact(state,pending,message);
  if(reason==='success'){assert.equal(state.inventory.stone,2);assert.equal(cue.kind,'stone');assert.equal(cue.time,state.time);assert.ok([cue.x,cue.y,cue.z,cue.floor].every(Number.isFinite));}
  else assert.equal(cue,null,reason);
  assert.equal(gatherImpact(state,pending,resolveGather(state,pending)),null);
 }
});

test('combat feedback uses actual confirmed targets including the killing blow, with no miss or windup cue',()=>{
 const state=freshGame();state.enemies.forEach(e=>e.hp=0);const enemy=state.enemies[0];Object.assign(enemy,{hp:20,type:'boar',x:state.player.x,z:state.player.z+2});state.inventory.sword=1;state.selected='sword';
 const windup=attack(state,{defer:true});assert.deepEqual(attackImpacts(state,windup),[]);state.time+=.225;
 const result=resolveAttack(state,windup.pending);assert.ok(enemy.hp<=0);const cues=attackImpacts(state,result);assert.equal(cues.length,1);assert.equal(cues[0].kind,'hit');assert.equal(cues[0].id,enemy.id);assert.ok(cues[0].z<enemy.z);
 assert.deepEqual(attackImpacts(state,resolveAttack(state,windup.pending)),[]);state.time+=1;const miss=attack(state,{defer:true});state.time+=.225;assert.deepEqual(attackImpacts(state,resolveAttack(state,miss.pending)),[]);
});

test('impact pool freezes on the game clock, expires, remains bounded and releases owned GPU buffers once',()=>{
 const pool=createImpactFeedback(12),geometry=pool.mesh.geometry,material=pool.mesh.material;let released=0;pool.mesh.addEventListener('dispose',()=>released++);geometry.addEventListener('dispose',()=>released++);material.addEventListener('dispose',()=>released++);
 const cue={kind:'tree',x:0,y:1,z:0,floor:0,time:10};assert.equal(pool.mesh.visible,false);pool.spawn(cue);pool.update(10.1);assert.ok(pool.active>0);const matrix=pool.mesh.instanceMatrix.array.slice();pool.update(10.1);assert.deepEqual(pool.mesh.instanceMatrix.array,matrix);
 for(let i=0;i<100;i++)pool.spawn({...cue,kind:'hit'});pool.update(10.1);assert.equal(pool.active,12);assert.equal(pool.mesh.instanceMatrix.count,12);
 const m=new THREE.Matrix4();for(let i=0;i<12;i++){pool.mesh.getMatrixAt(i,m);assert.ok(m.elements.every(Number.isFinite));}
 pool.update(11);assert.equal(pool.active,0);assert.equal(pool.mesh.visible,false);pool.spawn({...cue,time:11});pool.update(11.1);pool.update(5);assert.equal(pool.active,0,'time rewind clears stale bursts');pool.spawn({...cue,time:5});pool.clear();assert.equal(pool.active,0);
 pool.dispose();pool.dispose();assert.equal(released,3);assert.equal(pool.spawn(cue),false);
});

test('production save synchronization clears old impacts only when the state object changes',()=>{
 const pool=createImpactFeedback(),view={impacts:pool,batches:[],buildings:new Map(),creatures:new Map(),scene:new THREE.Scene()},state={buildings:[],enemies:[]};
 WorldView.prototype.sync.call(view,state);pool.spawn({kind:'hit',x:0,y:1,z:0,floor:0,time:10});pool.update(10.1);assert.equal(pool.active,6);
 WorldView.prototype.sync.call(view,state);assert.equal(pool.active,6);
 WorldView.prototype.sync.call(view,{buildings:[],enemies:[]});assert.equal(pool.active,0);pool.dispose();
});

test('the crab impact origin is outside the opaque shell rather than hidden inside it',()=>{
 const state=freshGame(),enemy=state.enemies.find(e=>e.type==='crab');Object.assign(enemy,{x:state.player.x,z:state.player.z+2.5});const cue=attackImpacts(state,{hits:[enemy.id]})[0],model=createCreature('crab');
 model.position.set(enemy.x,cue.floor,enemy.z);model.updateMatrixWorld(true);
 const ray=new THREE.Raycaster(new THREE.Vector3(cue.x,cue.floor+10,cue.z),new THREE.Vector3(0,-1,0)),hits=ray.intersectObject(model.userData.body,true);
 assert.ok(!hits.length||hits[0].point.y<cue.y-.01,'confirmed debris must not start beneath opaque crab shell');WorldView.prototype.disposeGroup(model);
});
