import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import {GameAudio} from '../src/audio.js';
import {createCharacter,animateCharacter} from '../src/character.js';
import {createWorld,terrain} from '../src/world.js';
import {freshGame,movePlayer,tick} from '../src/game.js';

test('world terrain footsteps follow visible contacts across downhill turns, blocking and shore transitions',()=>{
  for(const route of [
    {name:'highland',x:-75,z:-235,dx:0,dz:-1,run:true},
    {name:'water',x:32,z:5,dx:1,dz:0},
    {name:'shore',x:50,z:5,dx:-1,dz:0},
  ]){
    const state=freshGame(),world=createWorld(),root=createCharacter(),audio=new GameAudio(),dt=1/60;
    state.enemies=[];state.time=240;Object.assign(state.player,{x:route.x,z:route.z,yaw:Math.atan2(route.dx,route.dz)});root.rotation.y=state.player.yaw;
    let steps=0,splashes=0,stationarySounds=0,frameMoved=false,settledSounds=0;
    audio.effect=(kind,{surface}={})=>{
      const p=state.player,height=terrain(p.x,p.z);
      if(kind==='step'){
        assert.ok(height>=0,`${route.name}: underwater footstep`);
        assert.ok(root.userData.footContacts.some(Boolean),`${route.name}: footstep without rendered contact`);
        assert.equal(surface,height<2?'sand':'grass');steps++;
        if(!frameMoved)stationarySounds++;
      }else{assert.equal(kind,'splash');assert.ok(height<0);splashes++;}
    };
    const pose=()=>{const p=state.player,h=terrain(p.x,p.z);root.position.set(p.x,Math.max(h,-.45),p.z);animateCharacter(root,{...p,time:state.time,attackAt:-100,selected:'axe',swimming:h<0},dt,terrain);root.updateMatrixWorld(true);};
    for(let f=0;f<60;f++){tick(state,dt,false);pose();}
    audio.setActive(true);audio.update(state.player,state.time,terrain(state.player.x,state.player.z),root.userData.footfallCount);
    for(let frame=0;frame<480;frame++){
      const p=state.player,x=p.x,z=p.z;
      if(frame<300)movePlayer(state,world.objects,route.name==='highland'&&frame>=150?1:route.dx,route.name==='highland'&&frame>=150?0:route.dz,dt,Boolean(route.run));
      tick(state,dt,false);frameMoved=Math.hypot(p.x-x,p.z-z)>.00001;pose();audio.update(p,state.time,terrain(p.x,p.z),root.userData.footfallCount);
      if(frame>=420)assert.equal(stationarySounds,settledSounds,`${route.name}: stationary pose keeps producing steps`);
      if(frame===419)settledSounds=stationarySounds;
    }
    assert.ok(steps>0,`${route.name}: no land contacts sounded`);
    if(route.name==='highland')assert.equal(splashes,0);else assert.ok(splashes>0,`${route.name}: no swimming movement sounded`);
  }
});

test('highland tread and exposed rock sound only on rendered landing contacts',()=>{
  for(const {x,z,surface} of [{x:-82,z:-166,surface:'gravel'},{x:-89,z:-166,surface:'rock'},
    {x:-138,z:-185,surface:'grass'}]){
    const audio=new GameAudio(),heard=[],height=terrain(x,z);
    audio.effect=(kind,options)=>heard.push([kind,options.surface]);
    audio.setActive(true);
    audio.update({x,z},240,height,8,{swimming:false});
    audio.update({x,z},240.1,height,8,{swimming:false});
    assert.deepEqual(heard,[]);
    audio.update({x,z},240.2,height,9,{swimming:false});
    assert.deepEqual(heard,[['step',surface]]);
  }
});
