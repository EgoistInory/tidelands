import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import {createCharacter,animateCharacter} from '../src/character.js';
import {freshGame,movePlayer,tick} from '../src/game.js';
import {createWorld,terrain} from '../src/world.js';

test('sprinting down the exposed highland slope does not collapse the pelvis to reach an airborne foot',()=>{
  for(const fps of [30,60,144]){
    const root=createCharacter(),state=freshGame(),world=createWorld(),dt=1/fps;state.enemies=[];state.time=240;
    Object.assign(state.player,{x:-75,z:-235,yaw:Math.PI});root.rotation.y=Math.PI;
    const pose=()=>{const p=state.player;root.position.set(p.x,terrain(p.x,p.z),p.z);animateCharacter(root,{...p,time:state.time,attackAt:-100,selected:'axe'},dt,terrain);root.updateMatrixWorld(true);};
    for(let frame=0;frame<fps;frame++){tick(state,dt,false);pose();}
    let lowest=0;
    for(let frame=1;frame<=fps*6;frame++){
      if(frame<=fps*5)movePlayer(state,world.objects,frame<=fps*2.5?0:1,frame<=fps*2.5?-1:0,dt,true);
      tick(state,dt,false);pose();lowest=Math.min(lowest,root.userData.body.position.y);
      assert.ok(root.userData.ankles.every(a=>a.getWorldPosition(new THREE.Vector3()).toArray().every(Number.isFinite)));
    }
    assert.ok(lowest>-.6,`fps=${fps}, exposed production hill pelvis=${lowest}`);
  }
});
