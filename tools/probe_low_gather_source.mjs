import fs from 'node:fs';
import * as T from '../vendor/three.module.min.js';
import {loadAuthorFixture} from '../tests/helpers/author-fixture.js';
import {captureAuthorRest,retargetAuthoredClips} from '../src/authored-retarget.js';
const {body,library}=loadAuthorFixture();let skin;body.traverse(o=>{if(o.isSkinnedMesh)skin=o});const b=new T.Box3().setFromBufferAttribute(skin.geometry.attributes.position),height=b.max.y-b.min.y,group=new T.Group();group.scale.setScalar(2.95/height);group.add(body);const clips=retargetAuthoredClips(body,captureAuthorRest(library.scene),library.animations,height/library.height),mixer=new T.AnimationMixer(body),rows=[];
for(const name of ['Idle_Loop','Crouch_Idle_Loop','Fixing_Kneeling','PickUp_Table']){mixer.stopAllAction();const clip=clips.find(c=>c.name===name),a=mixer.clipAction(clip).reset().play();for(const phase of [0,.25,.5,.75,.99]){a.time=clip.duration*phase;mixer.update(0);group.updateMatrixWorld(true);const points=Object.fromEntries(['pelvis','hand_r','upperarm_r','foot_l','foot_r'].map(n=>[n,body.getObjectByName(n).getWorldPosition(new T.Vector3()).toArray()]));rows.push({name,phase,duration:clip.duration,points});}}
fs.writeFileSync(new URL('../docs/low-gather-source-poses.json',import.meta.url),JSON.stringify(rows,null,2));console.log(JSON.stringify(rows));
