// QA-only complete work-yard kit; not registered with gameplay contacts or shipped.
import * as T from '../vendor/three.module.min.js';
import {cottageSurfaces} from '../src/cottage-surfaces.js';
import {mergeStaticParts} from '../src/merge-parts.js';
export function createFishingYardCandidate(anchor={x:-33,z:77},heightAt=()=>0){
 const base=heightAt(anchor.x,anchor.z),root=new T.Group(),solids=[],posts=[];root.name='fishing-yard-candidate';root.position.set(anchor.x,base,anchor.z);
 const wood=cottageSurfaces().wood.clone(),paint=wood.clone(),rope=new T.MeshStandardMaterial({color:0xaba18a,roughness:1});paint.color.set(0x78908b);paint.bumpScale=.018;
 const pixels=new Uint8Array(64*64*4);for(let y=0;y<64;y++)for(let x=0;x<64;x++){const k=(y*64+x)*4;const strand=(x%16<2||y%16<2)?255:0;pixels[k]=pixels[k+1]=pixels[k+2]=strand;pixels[k+3]=255;}
 const netMap=new T.DataTexture(pixels,64,64);netMap.wrapS=netMap.wrapT=T.RepeatWrapping;netMap.repeat.set(6,3);netMap.generateMipmaps=true;netMap.minFilter=T.LinearMipmapLinearFilter;netMap.needsUpdate=true;
 const net=new T.MeshStandardMaterial({color:0x928675,alphaMap:netMap,alphaTest:.45,alphaToCoverage:true,side:T.DoubleSide,roughness:1});
 const paintPixels=new Uint8Array(256*256*4);
 for(let y=0;y<256;y++)for(let x=0;x<256;x++){
  const board=y/256*12,seam=(board%1)<.055,grain=Math.sin(x*.38+Math.sin(y*.23))*5;
  const chip=Math.sin(x*.071+y*.11)*Math.sin(x*.14-y*.047)>.57;
  const rgb=seam?[40,45,38]:chip?[137+grain,109+grain,73+grain]:[77+grain,111+grain,106+grain],at=(y*256+x)*4;
  for(let k=0;k<3;k++)paintPixels[at+k]=rgb[k];paintPixels[at+3]=255;
 }
 const paintMap=new T.DataTexture(paintPixels,256,256);paintMap.colorSpace=T.SRGBColorSpace;paintMap.wrapS=paintMap.wrapT=T.RepeatWrapping;paintMap.generateMipmaps=true;paintMap.minFilter=T.LinearMipmapLinearFilter;paintMap.needsUpdate=true;
 paint.map=paint.bumpMap=paintMap;paint.color.set(0xffffff);paint.bumpScale=.025;
 const materials=[wood,paint,rope,net],local=(x,z)=>heightAt(anchor.x+x,anchor.z+z)-base;
 function mesh(geometry,material,x,y,z,solid=true){const m=new T.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;root.add(m);if(solid)solids.push(m);return m;}
 const box=(w,h,d,x,y,z,material=wood,solid=true)=>mesh(new T.BoxGeometry(w,h,d),material,x,y,z,solid);
 const groundMax=Math.max(...[-3.2,3.2].flatMap(x=>[-1.3,1.3].map(z=>local(x,z)))),sill=groundMax+.65;
 // Four grounded trestle legs and two beams actually support the inverted repair hull.
 for(const x of [-2.3,2.3]){box(.3,.24,3,x,sill,0);for(const z of [-1.15,1.15]){const y=local(x,z),top=sill-.1;box(.19,top-y,.19,x,(y+top)/2,z);posts.push({x:anchor.x+x,z:anchor.z+z,foot:base+y,top:base+top});}}
 const positions=[],uv=[],indices=[],count=24,cross=12;
 for(let i=0;i<=count;i++)for(let j=0;j<=cross;j++){
  const u=i/count,a=(j/cross-.5)*Math.PI,width=.06+1.3*Math.pow(Math.sin(u*Math.PI),.65);
  positions.push((u-.5)*7.6,.12+Math.cos(a)*(.55+.45*Math.sin(u*Math.PI)),Math.sin(a)*width);uv.push(u*4,j/cross*1.5);
 }
 for(let i=0;i<count;i++)for(let j=0;j<cross;j++){const a=i*(cross+1)+j,b=a+cross+1;indices.push(a,b,a+1,b,b+1,a+1);}
 const hull=new T.BufferGeometry();hull.setAttribute('position',new T.Float32BufferAttribute(positions,3));hull.setAttribute('uv',new T.Float32BufferAttribute(uv,2));hull.setIndex(indices);hull.computeVertexNormals();paint.side=T.DoubleSide;mesh(hull,paint,0,sill,0);
 for(const side of [-1,1]){
  const points=[];for(let i=0;i<=24;i++){const u=i/24;points.push(new T.Vector3((u-.5)*7.6,sill+.12,side*(.06+1.3*Math.pow(Math.sin(u*Math.PI),.65))));}
  mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),24,.055,6,false),rope,0,0,0,false);
 }
 // Keel and two repair bands clarify the inverted boat silhouette at gameplay distance.
 const keel=[];for(let i=0;i<=24;i++){const u=i/24;keel.push(new T.Vector3((u-.5)*7.6,sill+.12+.55+.45*Math.sin(u*Math.PI),0));}
 mesh(new T.TubeGeometry(new T.CatmullRomCurve3(keel),24,.055,6,false),wood,0,0,0);
 for(const u of [.15,.85]){
  const points=[];for(let j=0;j<=16;j++){const a=(j/16-.5)*Math.PI;points.push(new T.Vector3((u-.5)*7.6,sill+.12+Math.cos(a)*(.55+.45*Math.sin(u*Math.PI)),Math.sin(a)*(.06+1.3*Math.pow(Math.sin(u*Math.PI),.65))));}
  mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),16,.04,6,false),wood,0,0,0,false);
 }
 // A full net-drying frame gives the yard a readable middle-distance silhouette.
 const netZ=-3.0,beam=Math.max(local(-3.3,netZ),local(3.3,netZ))+3.4;
 for(const x of [-3.3,3.3]){const y=local(x,netZ);box(.21,beam-y,.21,x,(beam+y)/2,netZ);posts.push({x:anchor.x+x,z:anchor.z+netZ,foot:base+y,top:base+beam});}
 box(7,.18,.22,0,beam,netZ);
 const cloth=new T.PlaneGeometry(6.4,2.4,24,8),p=cloth.attributes.position;
 for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i);p.setXYZ(i,x,y-.28*(1-(x/3.2)**2),Math.sin(x*1.1)*.08*(1-(y+1.2)/2.4));}cloth.computeVertexNormals();mesh(cloth,net,0,beam-1.25,netZ);
 // Three crates form one compositional cluster, not scattered single props.
 for(const [x,z,s]of [[4.6,.4,1.05],[4.8,1.65,.8],[4.6,.4,.75]]){
  const raised=s===.75?1.05:0,y=local(x,z)+raised+s/2;
  box(s,s,s,x,y,z);for(const sx of [-1,1])box(.075,s+.06,.075,x+sx*s*.43,y,z+s*.5+.025,rope,false);
 }
 root.updateMatrixWorld(true);
 const boxes=solids.map(m=>new T.Box3().setFromObject(m).expandByScalar(.035));
 mergeStaticParts(root);root.updateMatrixWorld(true);let released=false;
 return {root,posts,boxes,anchor:{...anchor,y:base},release(){if(released)return;released=true;for(const g of new Set(root.children.filter(m=>m.isMesh).map(m=>m.geometry)))g.dispose();for(const m of materials)m.dispose();netMap.dispose();paintMap.dispose();root.clear();}};
}
