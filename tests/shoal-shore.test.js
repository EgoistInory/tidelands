import test from 'node:test';
import assert from 'node:assert/strict';
import {shoalHabitat,shoalInterior} from '../src/shoal-habitat.js';
import {createWorld,terrain} from '../src/world.js';
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

test('the shoal inland passage stays open between shared scrub and exposed shoulder fields',()=>{
  const sample=(x,z)=>{
    const height=terrain(x,z);
    const slope=Math.hypot(terrain(x+.5,z)-terrain(x-.5,z),terrain(x,z+.5)-terrain(x,z-.5));
    return shoalInterior(x,z,height,slope);
  };
  assert.equal(sample(86,139),null);
  assert.equal(sample(-80,158),null);
  assert(sample(123,174).sand>.9&&sample(123,174).heath<.15);
  assert(sample(123,165).heath>.6&&sample(123,165).sand<.05);
  assert(sample(123,156).ledge>.18);

  const world=createWorld(),batches=createMeadow(undefined,world.objects,terrain,{shoal:true}).filter(batch=>batch.name==='shoal-scrub');
  const count=batches.reduce((sum,batch)=>sum+batch.count,0);
  assert(count>25&&count<90);
  for(const batch of batches){
    const position=batch.geometry.attributes.position;
    const low=Math.min(...Array.from({length:position.count},(_,i)=>position.getY(i)));
    const roots=Array.from({length:position.count},(_,i)=>i).filter(i=>position.getY(i)<=low+1e-6);
    for(let i=0;i<batch.count;i++){
      const matrix=batch.instanceMatrix.array.subarray(i*16,i*16+16),x=matrix[12],z=matrix[14];
      assert(sample(x,z).heath>.485&&sample(x,z).sand<.19);
      const rootGap=Math.max(...roots.map(index=>{
        const lx=position.getX(index),ly=position.getY(index),lz=position.getZ(index);
        return matrix[13]+matrix[5]*ly-terrain(x+matrix[0]*lx+matrix[8]*lz,z+matrix[2]*lx+matrix[10]*lz);
      }));
      assert(Math.abs(rootGap+.035)<.00002);
    }
  }
  const positions=batches[0].instanceMatrix.array,saved=positions.slice(0,16);
  assert(updateCampClearance(batches,[{x:saved[12],z:saved[14],type:'tent'}])>0);
  assert.equal(positions[13],-10000);
  assert(updateCampClearance(batches,[])>0);
  assert.deepEqual(positions.slice(0,16),saved);
});
