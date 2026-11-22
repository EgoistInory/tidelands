import test from 'node:test';
import assert from 'node:assert/strict';
import {shoalHabitat} from '../src/shoal-habitat.js';
import {terrain} from '../src/world.js';
import {createMeadow,updateCampClearance} from '../src/meadow.js';

test('the shoal uses distinct tidal sand, strand and dry dune bands on the existing heights',()=>{
  const patterns={wash:[],strand:[],dune:[]};
  for(let x=66;x<=125;x+=1)for(let z=129;z<=169;z+=1){
    const height=terrain(x,z),sample=shoalHabitat(x,z,height);
    for(const key of Object.keys(patterns))if(sample?.[key]>.5)patterns[key].push(height);
  }
  assert(Object.values(patterns).every(heights=>heights.length>30));
  assert(Math.max(...patterns.wash)<Math.min(...patterns.dune));
  assert(Math.max(...patterns.strand)<Math.max(...patterns.dune));
  assert.equal(shoalHabitat(86,139,-3),null);
  assert.equal(shoalHabitat(86,40,1.7),null);
});

test('dune grass clumps stay on the dry band and clear an existing camp reversibly',()=>{
  const batches=createMeadow(undefined,[],null,{shoal:true}).filter(batch=>batch.name==='shoal-dune');
  const count=batches.reduce((sum,batch)=>sum+batch.count,0);
  assert(count>25&&count<400);
  for(const batch of batches){
    const positions=batch.instanceMatrix.array;
    for(let i=0;i<batch.count;i++){
      const [x,y,z]=positions.slice(i*16+12,i*16+15);
      assert(y>2.7&&shoalHabitat(x,z,terrain(x,z))?.dune>.51);
    }
  }
  const batch=batches[0],positions=batch.instanceMatrix.array,saved=positions.slice(0,16);
  assert(updateCampClearance(batches,[{x:saved[12],z:saved[14],type:'campfire'}])>0);
  assert.equal(positions[13],-10000);
  assert(updateCampClearance(batches,[])>0);
  assert.deepEqual(positions.slice(0,16),saved);
});
