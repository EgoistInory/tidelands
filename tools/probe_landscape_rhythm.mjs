import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {createWorld} from '../src/world.js';
import {createMeadow} from '../src/meadow.js';
import {islandTreeAppearance} from '../src/landscape.js';

const sha=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const baseline=JSON.parse(fs.readFileSync(new URL('../docs/landscape-rhythm-base.json',import.meta.url)));
const world=createWorld(),worldSha=sha(world),batches=createMeadow(undefined,world.objects);
assert.equal(worldSha,baseline.world);assert.equal(batches.length,baseline.batches.length);
let count=0;
for(const [i,b]of batches.entries()){
  const prior=baseline.batches[i],a=[...b.instanceMatrix.array];
  if(b.name==='meadow-grass')for(let j=0;j<b.count;j++)a[j*16+5]=0;
  assert.equal(b.name,prior.name);assert.equal(b.count,prior.count);
  assert.equal(b.geometry.attributes.position.count,prior.vertices);
  assert.equal(sha(a),prior.placementSha,'Only grass vertical scale may change');count+=b.count;
}
const trees=world.objects.filter(o=>o.type==='tree'),heights=trees.map(o=>Math.max(.95,o.scale*islandTreeAppearance(o).height));
const files=['src/landscape.js','src/meadow.js','src/rock.js','tools/probe_landscape_rhythm.mjs'];
const result={passed:true,baselineCommit:baseline.commit,worldSha,resources:world.objects.length,enemies:world.enemies.length,treeCount:trees.length,meadowInstances:count,meadowBatches:batches.length,treeVerticalScaleRange:[Math.min(...heights),Math.max(...heights)],sourceSha256:Object.fromEntries(files.map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(new URL('../'+p,import.meta.url))).digest('hex')])),scope:'World state, meadow count/vertices/placement/width/rotation/RNG preserved; grass height and tree height/mineral geometry change. Not rendered naturalness, GPU or endurance acceptance.'};
fs.writeFileSync(new URL('../docs/landscape-rhythm-probe.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
