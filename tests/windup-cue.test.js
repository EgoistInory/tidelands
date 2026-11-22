import test from 'node:test';
import assert from 'node:assert/strict';
import {createWindupCue} from '../src/windup-cue.js';
import {ENEMY_ATTACK_IMPACT} from '../src/action-timing.js';

test('the enemy warning conforms to the slope and ends with the live windup',()=>{
  const height=(x,z)=>x*.45-z*.3;
  const cue=createWindupCue(height);
  const threat={enemy:{x:3,z:4,hp:40},pose:{at:10,yaw:Math.PI/2,resolved:false}};
  const positions=cue.mesh.geometry.attributes.position;
  assert.equal(cue.mesh.visible,false);

  cue.update(threat,10.15);
  assert.equal(cue.mesh.visible,true);
  for(let i=0;i<positions.count;i++){
    const x=positions.getX(i),z=positions.getZ(i);
    assert(x>threat.enemy.x);
    assert(Math.abs(positions.getY(i)-height(x,z)-.07)<.00001);
  }
  const version=positions.version;
  cue.update(threat,10.19);
  assert.equal(positions.version,version);
  cue.update(threat,10+ENEMY_ATTACK_IMPACT+.001);
  assert.equal(cue.mesh.visible,false);

  threat.pose.resolved=true;
  cue.update(threat,10.15);
  assert.equal(cue.mesh.visible,false);
  threat.pose.resolved=false;
  threat.enemy.hp=0;
  cue.update(threat,10.15);
  assert.equal(cue.mesh.visible,false);
  cue.dispose();
});
