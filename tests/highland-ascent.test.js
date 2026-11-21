import test from 'node:test';
import assert from 'node:assert/strict';
import {terrain,LANDMARKS} from '../src/world.js';
import {highlandAscent,HIGHLAND_ASCENT} from '../src/highland-ascent.js';
import {createShoreStones} from '../src/landscape.js';
import {createMeadow,updateCampClearance} from '../src/meadow.js';

test('the visible ascent stays continuous and clear to the existing lookout',()=>{
  const explorer=LANDMARKS.find(o=>o.id==='explorer');
  assert.deepEqual(HIGHLAND_ASCENT.at(-1),[explorer.x,explorer.z]);
  for(let i=1;i<HIGHLAND_ASCENT.length;i++){
    const [ax,az]=HIGHLAND_ASCENT[i-1],[bx,bz]=HIGHLAND_ASCENT[i];
    let previous=terrain(ax,az);
    for(let n=1;n<=16;n++){
      const x=ax+(bx-ax)*n/16,z=az+(bz-az)*n/16,height=terrain(x,z);
      assert.ok(height>=previous-.05 && height-previous<=1.1*Math.hypot(bx-ax,bz-az)/16);
      previous=height;
      const field=highlandAscent(x,z,height,.7);
      assert.ok(field.wear>.9);
      assert.equal(field.stone,0);
      assert.equal(field.plants,0);
    }
  }
  assert.equal(highlandAscent(-70,-187,terrain(-70,-187),.7).stone,0);
  assert.equal(highlandAscent(-70,-141,terrain(-70,-141),.7),null);
  assert.equal(highlandAscent(112,-23,terrain(112,-23),.7),null);
  assert.equal(highlandAscent(-79,-151,0,.7),null);
});

test('highland dressing stays off the tread and honors existing camp clearance',()=>{
  const stones=createShoreStones({highland:true}),meadow=createMeadow(undefined,[],null,{highland:true});
  for(const batches of [stones.filter(b=>b.name==='highland-scree'),meadow.filter(b=>b.name==='highland-heath')]){
    assert(batches.length>0);
    for(const batch of batches){
      const a=batch.instanceMatrix.array;
      for(let i=0;i<batch.count;i++){
        const x=a[i*16+12],z=a[i*16+14];
        const field=highlandAscent(x,z,terrain(x,z));
        assert(field&&field.wear<=.23);
      }
    }
    const batch=batches[0],a=batch.instanceMatrix.array,before=a.slice(0,16);
    assert(updateCampClearance(batches,[{type:'campfire',x:before[12],z:before[14]}])>0);
    assert.equal(a[13],-10000);
    assert(updateCampClearance(batches,[])>0);
    assert.deepEqual(a.slice(0,16),before);
  }
});
