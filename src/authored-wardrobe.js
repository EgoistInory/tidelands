import * as THREE from '../vendor/three.module.min.js';
import {createTextileMaterial} from './textile.js';

export const WARDROBE_ROLES=Object.freeze({
  traveler:{coat:0x9c5737,trousers:0x343e3b,scarf:0xd4c8a6,pack:0x5d4b38,sex:'male',hair:'Hair_SimpleParted',label:'旅人',cargo:'bedroll'},
  keeper:{coat:0x947b42,trousers:0x3c4140,scarf:0x74634e,pack:0x504333,sex:'male',hair:'Hair_Buzzed',label:'守灯人 · 阿岚',cargo:'lantern'},
  botanist:{coat:0x56755b,trousers:0x424d42,scarf:0xc4bc91,pack:0x6e563c,sex:'female',hair:'Hair_Buns',label:'药草师 · 林栖',cargo:'herbs'},
  explorer:{coat:0x4c6879,trousers:0x343f4a,scarf:0xc5b693,pack:0x6b5141,sex:'male',hair:'Hair_Long',label:'航海家 · 远舟',cargo:'chart'},
});
const vector=new THREE.Vector3();
function skinned(source,geometry,material,name){
  const mesh=new THREE.SkinnedMesh(geometry,material);mesh.name=name;mesh.position.copy(source.position);mesh.quaternion.copy(source.quaternion);mesh.scale.copy(source.scale);
  mesh.bind(source.skeleton,source.bindMatrix);mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;return mesh;
}
function subset(source,indices){const geometry=source.clone();geometry.setIndex(indices);geometry.clearGroups();return geometry;}
function headOrHandWeight(geometry,skeleton,index){
  const joints=geometry.attributes.skinIndex,weights=geometry.attributes.skinWeight;let total=0;
  for(let k=0;k<4;k++)if(/^(Head|neck_01|hand_[lr]|(?:thumb|index|middle|ring|pinky)_)/.test(skeleton.bones[joints.array[index*4+k]].name))total+=weights.array[index*4+k];
  return total;
}
function transferSkin(geometry,body){
  const points=body.geometry.attributes.position,sourceJ=body.geometry.attributes.skinIndex,sourceW=body.geometry.attributes.skinWeight;
  const positions=geometry.attributes.position,joints=[],weights=[];
  for(let i=0;i<positions.count;i++){
    const candidates=[];vector.fromBufferAttribute(positions,i);
    for(let j=0;j<points.count;j++){
      const distance=(vector.x-points.getX(j))**2+(vector.y-points.getY(j))**2+(vector.z-points.getZ(j))**2;
      if(candidates.length<4||distance<candidates.at(-1)[0]){candidates.push([distance,j]);candidates.sort((a,b)=>a[0]-b[0]);if(candidates.length>4)candidates.pop();}
    }
    const totals=new Map();for(const [distance,j]of candidates)for(let k=0;k<4;k++){const bone=sourceJ.array[j*4+k],weight=sourceW.array[j*4+k]/Math.max(distance,.00001);totals.set(bone,(totals.get(bone)??0)+weight);}
    const best=[...totals].sort((a,b)=>b[1]-a[1]).slice(0,4),total=best.reduce((sum,row)=>sum+row[1],0);
    while(best.length<4)best.push([0,0]);for(const [bone,weight]of best){joints.push(bone);weights.push(weight/total);}
  }
  geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(joints,4));geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));return geometry;
}
function coatGeometry(body,height){
  const vertices=[],uv=[],indices=[],columns=41;
  const rings=[[.45,.225,.157],[.48,.223,.155],[.55,.223,.180],[.61,.205,.180],[.67,.208,.190],[.73,.235,.205],[.79,.272,.210],[.825,.260,.18],[.855,.175,.135],[.875,.092,.095]];
  for(let r=0;r<rings.length;r++)for(let c=0;c<columns;c++){
    const [y,rx,rz]=rings[r],a=c/(columns-1)*Math.PI*2,crease=1+.018*Math.sin(a*6+r*.7);
    vertices.push(Math.sin(a)*rx*height/1.8*crease,y*height,-.025+Math.cos(a)*rz*height/1.8*crease);uv.push(c/(columns-1)*3,y*3);
    if(r<rings.length-1&&c<columns-1){const i=r*columns+c;
      // An open centre seam lets the two front panels separate over the thighs.
      if(!(r<2&&(c===0||c===39)))indices.push(i,i+columns,i+1,i+1,i+columns,i+columns+1);
    }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
  // Smooth height-based torso weights avoid a scalloped hem caused by nearest leg vertices.
  const joints=[],weights=[],boneIndex=name=>Math.max(0,body.skeleton.bones.findIndex(b=>b.name===name));
  const levels=[[.45,'pelvis'],[.55,'pelvis'],[.62,'spine_01'],[.70,'spine_02'],[.79,'spine_03'],[.875,'spine_03']];
  for(let i=0;i<vertices.length/3;i++){
    const y=vertices[i*3+1]/height;let a=levels[0],b=levels.at(-1);
    for(let n=1;n<levels.length;n++)if(y<=levels[n][0]){a=levels[n-1];b=levels[n];break;}
    const t=THREE.MathUtils.clamp((y-a[0])/Math.max(.00001,b[0]-a[0]),0,1);
    joints.push(boneIndex(a[1]),boneIndex(b[1]),0,0);weights.push(1-t,t,0,0);
  }
  geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(joints,4));geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));return geometry;
}
function bootGeometry(body,side,height){
  const vertices=[],uv=[],indices=[],segments=28;
  const rings=[[.004,.069,.151,-.015],[.03,.079,.159,-.015],[.08,.079,.151,-.022],[.14,.065,.097,-.045],[.22,.059,.069,-.05],[.29,.059,.065,-.047]];
  for(let r=0;r<rings.length;r++)for(let c=0;c<=segments;c++){
    const [y,rx,rz,z]=rings[r],a=c/segments*Math.PI*2,scale=height/1.8195863831788301;
    vertices.push((side*.114+Math.sin(a)*rx)*scale,y*scale,(z+Math.cos(a)*rz)*scale);uv.push(c/segments,y*3);
    if(r<rings.length-1&&c<segments){const i=r*(segments+1)+c;indices.push(i,i+segments+1,i+1,i+1,i+segments+1,i+segments+2);}
  }
  for(let c=1;c<segments-1;c++)indices.push(0,c+1,c);
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();return transferSkin(geometry,body);
}
function relaxedLimb(body,names,height,trousers,color){
  const bones=names.map(name=>body.skeleton.bones.find(b=>b.name===name));if(bones.some(b=>!b))return null;
  const points=bones.map(b=>body.worldToLocal(b.getWorldPosition(new THREE.Vector3())));
  // End inside the boot shaft or just before the wrist, leaving the original hands exposed.
  points[2].lerp(points[1],trousers?.36:.035);
  const curve=new THREE.CatmullRomCurve3(points),segments=12,sides=16,geometry=new THREE.TubeGeometry(curve,segments,1,sides,false),positions=geometry.attributes.position;
  const radii=trousers?[.14,.145,.13,.115,.11,.09]:[.105,.115,.105,.09,.095,.065],colors=[],joints=[],weights=[],boneIndices=bones.map(b=>body.skeleton.bones.indexOf(b));
  for(let ring=0;ring<=segments;ring++){
    const t=ring/segments,center=curve.getPointAt(t),at=t*(radii.length-1),i=Math.min(radii.length-2,Math.floor(at)),radius=THREE.MathUtils.lerp(radii[i],radii[i+1],at-i)*height/1.8;
    for(let side=0;side<=sides;side++){
      const index=ring*(sides+1)+side,fold=1+.018*Math.cos(side/sides*Math.PI*6+t*4),p=new THREE.Vector3().fromBufferAttribute(positions,index).sub(center).multiplyScalar(radius*fold).add(center);
      positions.setXYZ(index,p.x,p.y,p.z);colors.push(color.r,color.g,color.b);
      const bend=THREE.MathUtils.smoothstep(t,.35,.65);joints.push(boneIndices[0],boneIndices[1],0,0);weights.push(1-bend,bend,0,0);
    }
  }
  // Source-nearest weights can cross the inner thighs; each cloth tube follows its own two-bone chain.
  geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(joints,4));geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();return geometry;
}
function fixedToBone(avatar,boneName,mesh){
  const bone=avatar.getObjectByName(boneName);if(!bone)throw Error('Missing author bone '+boneName);avatar.updateMatrixWorld(true);bone.attach(mesh);mesh.castShadow=true;mesh.receiveShadow=true;return mesh;
}
function rigid(geometry,material,name,x,y,z){const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.position.set(x,y,z);return mesh;}

// Applied in the author's bind pose, before the display wrapper or animation mixer.
export function dressAuthoredAvatar(avatar,role='traveler'){
  const style=WARDROBE_ROLES[role];if(!style)throw Error('Unknown wardrobe role');if(avatar.getObjectByName('authored-wardrobe'))throw Error('Avatar already dressed');
  let body;avatar.traverse(o=>{if(o.isSkinnedMesh&&(!body||o.geometry.attributes.position.count>body.geometry.attributes.position.count))body=o;});
  if(!body)throw Error('Author body with skin is required');
  avatar.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromBufferAttribute(body.geometry.attributes.position),height=bounds.max.y-bounds.min.y;
  const group=new THREE.Group();group.name='authored-wardrobe';body.parent.add(group);
  const skin=[],cloth=[],geometry=body.geometry,source=geometry.index,positions=geometry.attributes.position;
  for(let t=0;t<source.count;t+=3){const tri=[source.getX(t),source.getX(t+1),source.getX(t+2)];
    (tri.every(i=>headOrHandWeight(geometry,body.skeleton,i)>.82)?skin:cloth).push(...tri);
  }
  group.add(skinned(body,subset(geometry,skin),body.material,'exposed-skin'));body.visible=false;
  const clothGeometry=subset(geometry,cloth),cp=clothGeometry.attributes.position,normals=clothGeometry.attributes.normal,colors=[];
  const coat=new THREE.Color(style.coat),pants=new THREE.Color(style.trousers),leather=new THREE.Color(style.pack);
  for(let i=0;i<cp.count;i++){
    const y=positions.getY(i)/height,offset=y<.19?.018:.025;
    cp.setXYZ(i,positions.getX(i)+normals.getX(i)*offset,positions.getY(i)+normals.getY(i)*offset,positions.getZ(i)+normals.getZ(i)*offset);
    const color=(y<.17?leather:y<.53?pants:coat);colors.push(color.r,color.g,color.b);
  }
  clothGeometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));clothGeometry.computeVertexNormals();
  const fabric=createTextileMaterial(0xffffff,{side:THREE.DoubleSide});fabric.vertexColors=true;
  group.add(skinned(body,clothGeometry,fabric,'clothed-body'));
  for(const side of ['l','r'])for(const trousers of [false,true]){
    const names=(trousers?['thigh','calf','foot']:['upperarm','lowerarm','hand']).map(name=>name+'_'+side),geometry=relaxedLimb(body,names,height,trousers,trousers?pants:coat);
    if(geometry)group.add(skinned(body,geometry,fabric,'relaxed-'+(trousers?'trouser-':'sleeve-')+side));
  }
  group.add(skinned(body,coatGeometry(body,height),createTextileMaterial(style.coat,{side:THREE.DoubleSide}),'travel-coat'));
  const leatherMaterial=new THREE.MeshStandardMaterial({color:style.pack,roughness:.86}),metal=new THREE.MeshStandardMaterial({color:0xafa07c,metalness:.55,roughness:.46});
  for(const side of [-1,1])group.add(skinned(body,bootGeometry(body,side,height),leatherMaterial,'travel-boot-'+side));
  const belt=rigid(new THREE.TorusGeometry(.219*height/1.8,.025,8,40),leatherMaterial,'waist-belt',0,height*.59,-.02);belt.rotation.x=Math.PI/2;belt.scale.y=.87;
  // Sample the belt too, so it shares torso bend rather than floating around the pelvis.
  belt.updateMatrix();belt.geometry.applyMatrix4(belt.matrix);group.add(skinned(body,transferSkin(belt.geometry,body),leatherMaterial,'waist-belt'));
  const scarf=rigid(new THREE.TorusGeometry(.089,.034,10,36),createTextileMaterial(style.scarf),'neck-scarf',0,height*.855,-.017);scarf.rotation.x=Math.PI/2;
  fixedToBone(avatar,'spine_03',scarf);
  const pack=new THREE.Group();pack.name='travel-pack';pack.position.set(0,height*.70,-.30);pack.add(rigid(new THREE.BoxGeometry(.30,.35,.15,3,4,2),leatherMaterial,'pack-body',0,0,0));
  pack.add(rigid(new THREE.BoxGeometry(.32,.10,.17),createTextileMaterial(style.pack),'pack-flap',0,.14,-.01));
  for(const x of [-.105,.105]){pack.add(rigid(new THREE.BoxGeometry(.035,.32,.015),leatherMaterial,'pack-binding',x,0,-.085),rigid(new THREE.BoxGeometry(.05,.04,.02),metal,'pack-buckle',x,-.06,-.10));}
  const cargo=rigid(new THREE.CylinderGeometry(.065,.065,.38,16),createTextileMaterial(style.scarf),style.cargo,0,.23,0);cargo.rotation.z=Math.PI/2;pack.add(cargo);
  if(style.cargo==='herbs')for(const x of [-.10,-.04,.04,.10]){const stem=rigid(new THREE.CylinderGeometry(.008,.008,.22,5),new THREE.MeshStandardMaterial({color:0x5a7847}), 'herb-stem',x,.19,-.06);stem.rotation.z=x*2;pack.add(stem);}
  if(style.cargo==='lantern'){const lamp=rigid(new THREE.CylinderGeometry(.055,.055,.12,8),metal,'keeper-lantern',.19,-.12,-.02);pack.add(lamp);}
  fixedToBone(avatar,'spine_03',pack);
  group.userData={role,label:style.label,body:body.name,height,sourceTriangles:source.count/3,skinTriangles:skin.length/3,clothTriangles:cloth.length/3,productionIntegrated:false};return group;
}

export function attachAuthorHair(avatar,hairScene,role){
  const style=WARDROBE_ROLES[role];if(!style)throw Error('Unknown wardrobe role');const head=avatar.getObjectByName('Head');if(!head)throw Error('Missing author head');
  let mesh;hairScene.traverse(o=>{if(o.isMesh)mesh=o;});if(!mesh||mesh.isSkinnedMesh)throw Error('Expected origin-space static author hair');
  // Buns/Long are authored on the female head; Buzzed/SimpleParted on the male.
  // Anchors measured from each actual rigged hairstyle, not from the selected role sex.
  avatar.updateMatrixWorld(true);const anchor=head.getWorldPosition(new THREE.Vector3());
  hairScene.updateMatrixWorld(true);
  const geometry=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);const femaleSource=style.hair==='Hair_Buns'||style.hair==='Hair_Long';
  geometry.translate(0,anchor.y-(femaleSource?1.549600005756255:1.5997999685933693),anchor.z-(femaleSource?-.010899782225668054:-.017399985977202482));
  const hair=new THREE.Mesh(geometry,mesh.material);hair.name=style.hair;fixedToBone(avatar,'Head',hair);return hair;
}
