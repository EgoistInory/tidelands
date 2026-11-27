import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3,Vector3} from '../vendor/three.module.min.js';
import {createForegroundFade} from '../src/camera-occlusion.js';

test('foreground fades when a low resource blocks the body while the higher framing ray is clear',()=>{
  const fade=createForegroundFade();
  const body=new Vector3(137.457,24.916,-47.217);
  const camera=new Vector3(139.549,30.093,-33.374);
  const crystal=new Box3(new Vector3(136.311,22.475,-45.855),new Vector3(138.770,25.644,-43.396));
  fade.update(body,camera,false,1/60,[crystal]);
  assert(fade.amount>0,'the lower sightline should start the existing fade');
  const beyondCamera=crystal.clone().translate(camera.clone().sub(body));
  for(let i=0;i<100;i++)fade.update(body,camera,false,1/60,[beyondCamera]);
  assert(fade.amount<.001,'a box beyond the camera should let the fade clear');
});
