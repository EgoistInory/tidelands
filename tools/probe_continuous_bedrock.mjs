// Quantify the real integration gaps before promoting the authority-height candidate.
import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import * as THREE from '../vendor/three.module.min.js';import * as original from '../src/world.js';import * as oldGame from '../src/game.js';import {visibleGroundSampler} from '../src/ground-support.js';
const sha=s=>createHash('sha256').update(s).digest('hex'),worldFile=new URL('../src/world.js',import.meta.url),gameFile=new URL('../src/game.js',import.meta.url);
const resolve=(source,file)=>source.replace(/from '([^']+)'/g,(_m,p)=>`from '${new URL(p,file).href}'`);
let source=resolve(fs.readFileSync(worldFile,'utf8').replace('export function terrain(x,z){','function baseTerrain(x,z){'),worldFile);
source=`import {continuousBedrockHeight} from '${new URL('../tests/continuous-bedrock-candidate.js',import.meta.url).href}';\n`+source+'\nexport function terrain(x,z){return continuousBedrockHeight(x,z,baseTerrain(x,z),ISLANDS,protectedCompositionSites);}';
const moduleURL='data:text/javascript;base64,'+Buffer.from(source).toString('base64'),candidate=await import(moduleURL);
const gameSource=resolve(fs.readFileSync(gameFile,'utf8'),gameFile).replaceAll(worldFile.href,moduleURL),game=await import('data:text/javascript;base64,'+Buffer.from(gameSource).toString('base64'));
function plane(fn){const geometry=new THREE.PlaneGeometry(800,800,320,320);geometry.rotateX(-Math.PI/2);const p=geometry.attributes.position;for(let i=0;i<p.count;i++)p.setY(i,fn(p.getX(i),p.getZ(i)));return {geometry,sample:visibleGroundSampler(geometry)};}
const before=plane(original.terrain),after=plane(candidate.terrain),oldWorld=original.createWorld(),world=candidate.createWorld();
let maxBefore=0,maxAfter=0,maxAt=null,overHalfMetre=0;
for(let z=-330;z<=-140;z+=1.25)for(let x=-170;x<=20;x+=1.25){const a=Math.abs(original.terrain(x,z)-before.sample(x,z)),b=Math.abs(candidate.terrain(x,z)-after.sample(x,z));maxBefore=Math.max(maxBefore,a);if(b>maxAfter){maxAfter=b;maxAt={x,z,authority:candidate.terrain(x,z),visible:after.sample(x,z)};}if(b>.5)overHalfMetre++;}
const roots=world.objects.map(o=>({id:o.id,type:o.type,x:o.x,z:o.z,authority:o.y,visible:after.sample(o.x,o.z),error:o.y-after.sample(o.x,o.z)})).sort((a,b)=>Math.abs(b.error)-Math.abs(a.error));
const oldValidCamps=[];
for(let z=-310;z<-155;z+=5)for(let x=-155;x<0;x+=5){
 const old=oldGame.freshGame(),next=game.freshGame();for(const s of [old,next]){s.player.x=x;s.player.z=z;s.inventory.wood=s.inventory.stone=100;s.enemies=[];}
 if(oldGame.canBuild(old,oldWorld.objects,'campfire',x,z))continue;
 const rejection=game.canBuild(next,world.objects,'campfire',x,z);if(rejection)oldValidCamps.push({x,z,oldHeight:original.terrain(x,z),newHeight:candidate.terrain(x,z),newRejection:rejection});
}
const steepSteps=[];
for(let z=-310;z<-155;z+=2.5)for(let x=-155;x<0;x+=2.5){
 const dx=candidate.terrain(x+.2,z)-candidate.terrain(x-.2,z),dz=candidate.terrain(x,z+.2)-candidate.terrain(x,z-.2),grade=Math.hypot(dx,dz)/.4;if(grade<1.6)continue;
 const state=game.freshGame();Object.assign(state.player,{x,z});state.enemies=[];game.movePlayer(state,[],dx,dz,1/60,false);const moved=Math.hypot(state.player.x-x,state.player.z-z),rise=candidate.terrain(state.player.x,state.player.z)-candidate.terrain(x,z);
 if(moved>.01&&rise/moved>1.6)steepSteps.push({from:{x,z},to:{x:state.player.x,z:state.player.z},moved,rise,grade:rise/moved});
}
steepSteps.sort((a,b)=>b.grade-a.grade);
const normal=JSON.parse(fs.readFileSync(new URL('../docs/native-camp-night-2026-11-04/final-save.json',import.meta.url),'utf8'));
const anchors=[{id:'current-ordinary-player',...normal.player},...normal.buildings].map(p=>({id:p.id,x:p.x,z:p.z,oldHeight:original.terrain(p.x,p.z),candidateHeight:candidate.terrain(p.x,p.z)}));
assert(maxAfter>.5&&roots.some(p=>Math.abs(p.error)>.5)&&steepSteps.length>0,'The probe must expose genuine integration gaps rather than claim a static image is playable.');
const out=new URL('../docs/continuous-bedrock-2026-11-05/',import.meta.url);fs.mkdirSync(out,{recursive:true});
const report={worldSourceSha256:sha(fs.readFileSync(worldFile)),candidateSourceSha256:sha(fs.readFileSync(new URL('../tests/continuous-bedrock-candidate.js',import.meta.url))),gameSourceSha256:sha(fs.readFileSync(gameFile)),probeSha256:sha(fs.readFileSync(new URL(import.meta.url))),productionAdopted:false,mesh:{segments:320,vertices:103041,maxBeforeAuthorityVisibleError:maxBefore,maxCandidateAuthorityVisibleError:maxAfter,maxAt,samplesOverHalfMetre:overHalfMetre},resourceRoots:{overHalfMetre:roots.filter(p=>Math.abs(p.error)>.5).length,worst:roots.slice(0,10)},hypotheticalPreviouslyBuildableCampSites:{newlyRejected:oldValidCamps.length,examples:oldValidCamps.slice(0,10),scope:'Synthetic rule probe, empty enemies, ample inventory; not actual user camps or proof of existing-save failure.'},actualOrdinaryAnchors:anchors,steepMovement:{stepsOverGrade1_6:steepSteps.length,worst:steepSteps.slice(0,10),scope:'Candidate production movePlayer, isolated empty-object/enemy rule states; actual terrain rise and displacement. Not browser movement or avatar contact.'},conclusion:'Do not promote yet: unify authoritative/visible support, protect old camp usability, and enforce meaningful slope traversal before native path acceptance.'};
fs.writeFileSync(new URL('integration-probe.json',out),JSON.stringify(report,null,2)+'\n');before.geometry.dispose();after.geometry.dispose();console.log(JSON.stringify({maxBefore,maxAfter,resourceRootsOverHalfMetre:report.resourceRoots.overHalfMetre,newlyRejectedSyntheticCamps:oldValidCamps.length,steepSteps:steepSteps.length,actualOrdinaryAnchors:anchors}));
