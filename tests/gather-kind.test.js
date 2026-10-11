import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import {createCharacter,animateCharacter} from '../src/character.js';

// The skin palm is the second mesh on the right forearm, not the hidden sword.
const palmBounds=root=>new THREE.Box3().setFromObject(root.userData.elbows[1].children[1]);
const pose={x:0,z:0,yaw:0,time:.21,attackAt:-100,gatherAt:0,selected:'sword'};

test('plant and shell gathering lowers the visible bare palm and restores carried equipment',()=>{
  for(const [gatherKind,ceiling] of [['berry',1.15],['fiber',1.15],['shell',.8]]){
    const root=createCharacter();
    animateCharacter(root,{...pose,gatherKind,gatherTool:'hand'},1/60,()=>0);root.updateMatrixWorld(true);
    const bounds=palmBounds(root);
    assert.ok(bounds.max.y<ceiling,`${gatherKind} palm too high: ${bounds.min.y}..${bounds.max.y}`);
    assert.ok(bounds.min.y>.08,`${gatherKind} palm crosses ground`);
    assert.ok(root.userData.body.position.y<-.3,`${gatherKind} does not crouch`);
    assert.equal(root.userData.axe.visible,false);assert.equal(root.userData.sword.visible,false);
    animateCharacter(root,{...pose,gatherKind,gatherTool:'hand',time:.5},1/60,()=>0);
    assert.equal(root.userData.sword.visible,true);assert.equal(root.userData.axe.visible,false);
  }
});

test('a crouching gathering cycle keeps planted soles on flat and sloped ground',()=>{
  for(const slope of [0,.12]){
    const root=createCharacter(),ground=(x,z)=>.03*x+slope*z;
    animateCharacter(root,{...pose,time:-.01,gatherKind:'shell',gatherTool:'hand'},1/60,ground);root.updateMatrixWorld(true);
    const before=root.userData.ankles.map(a=>a.getWorldPosition(new THREE.Vector3()));
    let deepest=0;
    for(let frame=0;frame<=60;frame++){
      animateCharacter(root,{...pose,time:frame/60,gatherKind:'shell',gatherTool:'hand'},1/60,ground);root.updateMatrixWorld(true);
      deepest=Math.min(deepest,root.userData.body.position.y);
      for(let side=0;side<2;side++){
        const ankle=root.userData.ankles[side],sole=ankle.getObjectByName('boot-sole'),positions=sole.geometry.attributes.position;
        assert.ok(ankle.getWorldPosition(new THREE.Vector3()).distanceTo(before[side])<1e-7,'planted foot drifts');
        for(let i=0;i<positions.count;i++){
          const p=new THREE.Vector3().fromBufferAttribute(positions,i).applyMatrix4(sole.matrixWorld);
          assert.ok(p.y-ground(p.x,p.z)>-1e-7,'crouching sole penetrates ground');
        }
      }
    }
    assert.ok(deepest<-.4,'shell gathering remains standing');
    assert.ok(root.userData.body.position.y>-.1,'pelvis fails to recover');
    assert.deepEqual(root.position.toArray(),[0,0,0]);
  }
});

test('hard resource gathering uses the supplied harvesting tool while attacks keep the selected weapon',()=>{
  const root=createCharacter();
  animateCharacter(root,{...pose,gatherKind:'stone',gatherTool:'axe'},1/60,()=>0);
  assert.equal(root.userData.axe.visible,true);assert.equal(root.userData.sword.visible,false);
  animateCharacter(root,{...pose,gatherKind:'stone',gatherTool:'hand'},1/60,()=>0);
  assert.equal(root.userData.axe.visible,false);assert.equal(root.userData.sword.visible,false);
  animateCharacter(root,{...pose,gatherKind:'stone',gatherTool:'axe',attackAt:0},1/60,()=>0);
  assert.equal(root.userData.axe.visible,false);assert.equal(root.userData.sword.visible,true);
});
