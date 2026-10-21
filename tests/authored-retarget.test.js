import test from 'node:test';import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.min.js';
import {captureAuthorRest,retargetAuthoredClips} from '../src/authored-retarget.js';
function rig(length,angle){const root=new T.Group(),bone=new T.Bone();bone.name='calf_l';bone.position.y=length;bone.rotation.x=angle;bone.scale.set(1,1,1);root.add(bone);return{root,bone};}
test('retargeting preserves target limb length and rest orientation without modifying the source clip',()=>{
 const source=rig(.5,.2),target=rig(.4,.1),times=[0,1],values=[0,.5,0,0,.6,0],qs=[...source.bone.quaternion.toArray(),...new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),.4).toArray()];
 const clip=new T.AnimationClip('walk',1,[new T.VectorKeyframeTrack('calf_l.position',times,values),new T.QuaternionKeyframeTrack('calf_l.quaternion',times,qs)]);
 const out=retargetAuthoredClips(target.root,captureAuthorRest(source.root),[clip])[0];assert.deepEqual(Array.from(clip.tracks[0].values),Array.from(new Float32Array(values)));
 const mixer=new T.AnimationMixer(target.root);mixer.clipAction(out).play();mixer.update(0);assert.ok(Math.abs(target.bone.position.y-.4)<1e-6);assert.ok(Math.abs(target.bone.rotation.x-.1)<1e-6);mixer.update(.5);assert.ok(Math.abs(target.bone.position.y-.44)<1e-6);assert.ok(Math.abs(target.bone.rotation.x-.2)<1e-6);assert.equal(out.duration,clip.duration);
});
test('retargeting scales pelvis translations by body ratio, keeps author timing and rejects unknown tracks',()=>{
 const s=rig(1,0),t=rig(.9,0);s.bone.name=t.bone.name='pelvis';const clip=new T.AnimationClip('swim',2,[new T.VectorKeyframeTrack('pelvis.position',[0,2],[0,1,0,0,.5,1])]);
 const out=retargetAuthoredClips(t.root,captureAuthorRest(s.root),[clip],.9)[0];assert.ok(Math.abs(out.tracks[0].values[4]-.45)<1e-6);assert.ok(Math.abs(out.tracks[0].values[5]-.9)<1e-6);assert.deepEqual(Array.from(out.tracks[0].times),[0,2]);
 const invalid=new T.AnimationClip('bad',1,[new T.VectorKeyframeTrack('unknown.position',[0,1],[0,0,0,1,0,0])]);assert.throws(()=>retargetAuthoredClips(t.root,captureAuthorRest(s.root),[invalid]),/bone/);
});
