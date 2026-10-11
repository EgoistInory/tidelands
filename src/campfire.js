import * as THREE from '../vendor/three.module.min.js';

export function createFlame(){
  const positions=[],uvs=[],phases=[],indices=[];
  for(let i=0;i<3;i++){
    const angle=i*Math.PI/3,c=Math.cos(angle)*.8,s=Math.sin(angle)*.8,offset=i*4;
    positions.push(-c,.2,-s,c,.2,s,-c,2.1,-s,c,2.1,s);
    uvs.push(0,0,1,0,0,1,1,1);phases.push(i*2.1,i*2.1,i*2.1,i*2.1);
    indices.push(offset,offset+1,offset+2,offset+2,offset+1,offset+3);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geometry.setAttribute('phase',new THREE.Float32BufferAttribute(phases,1));geometry.setIndex(indices);
  const material=new THREE.ShaderMaterial({
    uniforms:THREE.UniformsUtils.merge([THREE.UniformsLib.fog,{time:{value:0}}]),
    side:THREE.DoubleSide,forceSinglePass:true,transparent:true,depthWrite:false,fog:true,
    vertexShader:`attribute float phase;
      varying vec2 flameUv;varying float flamePhase;
      #include <fog_pars_vertex>
      void main(){flameUv=uv;flamePhase=phase;vec4 mvPosition=modelViewMatrix*vec4(position,1.0);
        gl_Position=projectionMatrix*mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader:`uniform float time;varying vec2 flameUv;varying float flamePhase;
      #include <fog_pars_fragment>
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),f.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0)),f.x),f.y);}
      void main(){float y=flameUv.y,x=flameUv.x*2.0-1.0,t=time+flamePhase;
        float n=noise(vec2(x*4.0,y*6.0-t*2.4))*.7+noise(vec2(x*8.0,y*12.0-t*4.8))*.3;
        float center=x+sin(y*7.0-t*3.0)*y*.18;
        float width=(1.0-y)*(.64+.1*sin(t*4.0))+.04;
        float density=1.0-smoothstep(width-.18,width+.08,abs(center)+n*.16);
        float tip=1.0-smoothstep(.7+n*.2,.92+n*.07,y);
        float alpha=density*tip*smoothstep(0.0,.09,y)*.82;
        if(alpha<.015)discard;
        float heat=clamp((1.0-y)*density*.85+n*.16,0.0,1.0);
        vec3 color=mix(vec3(1.0,.055,.005),vec3(1.0,.58,.08),smoothstep(.12,.6,heat));
        color=mix(color,vec3(1.0,.93,.53),smoothstep(.62,.91,heat));
        gl_FragColor=vec4(color*1.8,alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`
  });
  return new THREE.Mesh(geometry,material);
}

export function updateCampfire(group,time){
  const flame=group.userData.flame;if(!flame)return;
  flame.material.uniforms.time.value=time%4096+(group.position.x*.31+group.position.z*.17)%64;
}
