import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createTree} from '../src/tree.js';
import {createWeatheredRock} from '../src/rock.js';
import {createWorld} from '../src/world.js';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),sources={};
for(const file of fs.readdirSync('src').filter(f=>f.endsWith('.js')).sort())sources['src/'+file]=sha(fs.readFileSync('src/'+file));
const trees={};
for(const form of ['coast','forest','highland','shoal']){
  const tree=createTree(form),leaf=tree.children.find(m=>m.material.alphaTest>0),p=leaf.geometry.attributes.position,c=leaf.geometry.attributes.color;
  const values=Array.from({length:p.count},(_,i)=>({y:p.getY(i),v:c.getY(i)})).sort((a,b)=>a.y-b.y),q=Math.floor(values.length/4),mean=a=>a.reduce((sum,r)=>sum+r.v,0)/a.length;
  let bytes=0,triangles=0;tree.traverse(m=>{if(!m.geometry)return;for(const a of Object.values(m.geometry.attributes))bytes+=a.array.byteLength;bytes+=m.geometry.index?.array.byteLength??0;triangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;});
  trees[form]={triangles,bytes,leafVertices:p.count,lowerValue:mean(values.slice(0,q)),upperValue:mean(values.slice(-q)),bounds:[leaf.geometry.boundingBox.min.toArray(),leaf.geometry.boundingBox.max.toArray()]};
  tree.traverse(m=>m.geometry?.dispose());
}
const rock=createWeatheredRock(1.8),position=rock.geometry.attributes.position,top=[];
for(let i=0;i<position.count;i++)if(Math.abs(position.getX(i))<.45&&Math.abs(position.getZ(i))<.45&&position.getY(i)>1)top.push(position.getY(i));
const report={sources,worldSha256:sha(JSON.stringify(createWorld())),trees,rock:{triangles:position.count/3,upperFaceSamples:top.length,upperFaceHeightRange:Math.max(...top)-Math.min(...top),bounds:[rock.geometry.boundingBox.min.toArray(),rock.geometry.boundingBox.max.toArray()]},scope:'CPU geometry/value probes and exact source fingerprints, not rendered appearance, GPU, physical contact or full quality acceptance.'};
rock.geometry.dispose();const path=process.argv[2];if(!path)throw Error('Expected an explicit output path');fs.writeFileSync(path,JSON.stringify(report,null,2)+'\n');console.log(path);
