import * as THREE from '../vendor/three.module.min.js';

// Elliptic sections form the jaw, cheeks and cranium. Front relief is part of
// this surface, so the nose and lips do not float as separate primitives.
const profile=[[-.235,.052,.080,.045],[-.219,.086,.090,.031],[-.180,.111,.113,.010],[-.140,.129,.140,.006],[-.090,.154,.152,0],[-.045,.160,.153,-.002],[0,.166,.156,-.004],[.045,.161,.158,-.002],[.090,.158,.158,0],[.140,.153,.157,-.003],[.190,.134,.147,-.006],[.225,.091,.113,-.008],[.245,.018,.030,-.006]];
const bell=(value,center,width)=>Math.exp(-.5*((value-center)/width)**2);
function section(y){
  for(let i=1;i<profile.length;i++)if(y<=profile[i][0]){
    const a=profile[i-1],b=profile[i],t=THREE.MathUtils.clamp((y-a[0])/(b[0]-a[0]),0,1);
    return a.slice(1).map((v,j)=>THREE.MathUtils.lerp(v,b[j+1],t));
  }
  return profile.at(-1).slice(1);
}
function relief(x,y){
  return .016*bell(x,0,.027)*bell(y,.004,.062)+.036*bell(x,0,.035)*bell(y,-.043,.025)
    +.010*bell(x,0,.047)*bell(y,-.107,.012)+.012*bell(x,0,.043)*bell(y,-.127,.013)
    +.010*bell(x,0,.075)*bell(y,-.179,.020)
    +[-1,1].reduce((v,side)=>v-.012*bell(x,side*.073,.038)*bell(y,.045,.024)+.008*bell(x,side*.114,.035)*bell(y,-.021,.039),0);
}
function front(x,y){const [width,depth,center]=section(y),c=Math.sqrt(Math.max(0,1-(x/width)**2));return center+depth*c+relief(x,y)*c**6;}
function shell(vertices,columns,rows,{bottom=true,top=true,colors=null}={}){
  const indices=[];
  for(let row=0;row<rows-1;row++)for(let col=0;col<columns;col++){
    const a=row*columns+col,b=row*columns+(col+1)%columns,c=b+columns,d=a+columns;indices.push(a,b,d,b,c,d);
  }
  for(const [row,enabled,reverse] of [[0,bottom,true],[rows-1,top,false]])if(enabled){
    const center=[0,0,0];for(let i=0;i<columns;i++)for(let axis=0;axis<3;axis++)center[axis]+=vertices[(row*columns+i)*3+axis]/columns;
    const cap=vertices.length/3;vertices.push(...center);if(colors)colors.push(...colors.slice(row*columns*3,row*columns*3+3));
    for(let i=0;i<columns;i++){const a=row*columns+i,b=row*columns+(i+1)%columns;indices.push(cap,reverse?b:a,reverse?a:b);}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);
  if(colors)geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();return geometry;
}
function faceGeometry(){
  const vertices=[],colors=[],columns=48,rows=49;
  for(let row=0;row<rows;row++){
    const y=THREE.MathUtils.lerp(-.235,.245,row/(rows-1)),[width,depth,center]=section(y);
    for(let col=0;col<columns;col++){
      const angle=col/columns*Math.PI*2,x=width*Math.sin(angle),c=Math.cos(angle),facing=Math.max(0,c)**6;
      vertices.push(x,y,center+depth*c+relief(x,y)*facing);
      const cheeks=bell(Math.abs(x),.105,.045)*bell(y,-.015,.045)*facing,lips=bell(x,0,.050)*bell(y,-.118,.020)*facing;
      colors.push(1-.018*lips,1-.035*cheeks-.065*lips,1-.050*cheeks-.090*lips);
    }
  }
  return shell(vertices,columns,rows,{colors});
}
function hairGeometry(){
  const vertices=[],colors=[],columns=48,rows=17;
  for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
    const angle=col/columns*Math.PI*2,t=row/(rows-1),edge=.045+.080*Math.cos(angle)+.012*Math.sin(angle*3+.4);
    const y=THREE.MathUtils.lerp(edge,.258,t),[width,depth,center]=section(Math.min(.245,y));
    const ridge=.008+.005*(.5+.5*Math.cos(angle*11+t*6))*Math.sin(t*Math.PI);
    const crown=y>.190?Math.max(.005,Math.sqrt(Math.max(0,1-((y-.190)/.068)**2))):null;
    const hairWidth=crown===null?width+ridge:(.134+ridge)*crown,hairDepth=crown===null?depth+ridge:(.147+ridge)*crown;
    vertices.push(hairWidth*Math.sin(angle),y,center+hairDepth*Math.cos(angle));
    const shade=.86+.14*(.5+.5*Math.cos(angle*11+t*6));const color=new THREE.Color(0x39332b).multiplyScalar(shade);colors.push(color.r,color.g,color.b);
  }
  return shell(vertices,columns,rows,{bottom:false,colors});
}

export function createTravelerHead(materialFor){
  const group=new THREE.Group();group.name='traveler-head';group.position.set(0,2.70,.015);
  const add=(name,geometry,color,x=0,y=0,z=0)=>{
    const mesh=new THREE.Mesh(geometry,materialFor(color));mesh.name=name;mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);return mesh;
  };
  const face=add('traveler-head-surface',faceGeometry(),0xc79878);face.material=face.material.clone();face.material.vertexColors=true;
  const hair=add('traveler-hair',hairGeometry(),0x302c26);hair.material=hair.material.clone();hair.material.color.set(0xffffff);hair.material.vertexColors=true;
  const ellipsoid=(name,color,position,scale)=>{const mesh=add(name,new THREE.SphereGeometry(1,16,10),color,...position);mesh.scale.set(...scale);return mesh;};
  const curve=(name,color,points,radius)=>add(name,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(([x,y,offset])=>new THREE.Vector3(x,y,front(x,y)+offset))),16,radius,5,false),color);
  for(const side of [-1,1]){
    const label=side<0?'left':'right',x=side*.073,y=.045,z=front(x,y);
    ellipsoid('ear-'+label,0xc79878,[side*.170,-.006,.003],[.026,.048,.029]);
    ellipsoid('ear-fold-'+label,0xb28263,[side*.189,-.006,.012],[.009,.030,.017]);
    ellipsoid('eye-'+label,0xd8cbb6,[x,y,z+.008],[.033,.010,.013]);
    ellipsoid('iris-'+label,0x555c4d,[x,y,z+.020],[.0075,.0075,.004]);
    ellipsoid('pupil-'+label,0x282b26,[x,y,z+.023],[.0038,.0048,.002]);
    curve('eyelid-'+label,0xae7d60,[[x-.032,y,.009],[x-.016,y+.009,.014],[x+.012,y+.010,.014],[x+.032,y+.001,.009]],.0028);
    curve('brow-'+label,0x44392d,[[x-.034,y+.040,.006],[x-.012,y+.047,.008],[x+.015,y+.045,.008],[x+.034,y+.037,.005]],.004);
    ellipsoid('nostril-'+label,0x805940,[side*.022,-.058,front(side*.022,-.058)+.001],[.008,.0035,.0025]);
  }
  curve('mouth-line',0x855943,[[-.044,-.111,.001],[-.020,-.114,.002],[0,-.115,.002],[.020,-.114,.002],[.044,-.111,.001]],.0025);
  return group;
}
