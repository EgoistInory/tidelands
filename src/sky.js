import * as THREE from '../vendor/three.module.min.js';
import {dayCycle,weatherAt} from './world.js';

export function skyPalette(time,cloudiness=0){
  const {daylight}=dayCycle(time),light=(daylight-.04)/.96;
  const twilight=4*light*(1-light);
  const horizon=new THREE.Color(0x101a28).lerp(new THREE.Color(0xb8d4d5),Math.sqrt(light));
  horizon.lerp(new THREE.Color(0xc6997c),twilight*.5);
  const zenith=new THREE.Color(0x050c1d).lerp(new THREE.Color(0x558eb5),light);
  const cloud=new THREE.Color(0x182535).lerp(new THREE.Color(0xf0efe5),light);
  cloud.lerp(new THREE.Color(0xd9ac8b),twilight*.4);
  const weatherLight=.04+light*.96;
  horizon.lerp(new THREE.Color(0x9ea9b0).multiplyScalar(weatherLight),cloudiness*.85);
  zenith.lerp(new THREE.Color(0x85949f).multiplyScalar(weatherLight),cloudiness*.85);
  cloud.lerp(new THREE.Color(0xc8cdd0).multiplyScalar(weatherLight),cloudiness*.85);
  return {horizon,zenith,cloud,light};
}

// One atmospheric field drives the visible sky and the sea reflection.
export const atmosphereGLSL=`
      float hash(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
      float layers(vec2 p){float n=0.0,a=.55;for(int i=0;i<4;i++){n+=noise(p)*a;p=p*2.07+vec2(13.1,7.7);a*=.5;}return n;}
      vec3 sampleAtmosphere(vec3 direction,vec2 origin,float time,vec3 horizon,vec3 zenith,vec3 cloud,float light,float cloudiness,float sunlight){
        vec3 d=normalize(direction);float elevation=max(d.y,0.0);
        vec3 color=mix(horizon,zenith,pow(elevation,.45));
        // A distant cloud sheet: soft density edges and shaded bases, without opaque faceted puffs.
        vec2 p=d.xz/max(d.y,.025)*1.6+origin*.018+vec2(time*.003,time*.001);
        float density=layers(p),coverage=smoothstep(mix(.43,.16,cloudiness),mix(.68,.43,cloudiness),density)*smoothstep(.015,.12,d.y);
        float baseShade=mix(.62,1.0,smoothstep(.46,.77,density));
        color=mix(color,cloud*baseShade,coverage*.92);
        vec3 sunDirection=normalize(vec3(-70.0,100.0,40.0));
        float glow=pow(max(dot(d,sunDirection),0.0),32.0)*light*sunlight*(1.0-coverage)*.12;
        color+=vec3(1.0,.83,.60)*glow;
        return color;
      }
`;

export function createSky(){
  const palette=skyPalette(240);
  const material=new THREE.ShaderMaterial({
    side:THREE.BackSide,depthWrite:false,depthTest:false,fog:false,
    uniforms:{time:{value:0},origin:{value:new THREE.Vector2()},horizon:{value:palette.horizon},zenith:{value:palette.zenith},cloud:{value:palette.cloud},light:{value:palette.light},cloudiness:{value:0},sunlight:{value:1}},
    vertexShader:`varying vec3 direction;
      void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`varying vec3 direction;
      uniform float time,light,cloudiness,sunlight;uniform vec2 origin;uniform vec3 horizon,zenith,cloud;
      ${atmosphereGLSL}
      void main(){
        vec3 color=sampleAtmosphere(direction,origin,time,horizon,zenith,cloud,light,cloudiness,sunlight);
        gl_FragColor=vec4(color,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  const sky=new THREE.Mesh(new THREE.SphereGeometry(850,32,16),material);
  sky.name='tidelands-sky';sky.renderOrder=-100;sky.frustumCulled=false;
  return sky;
}

export function updateSky(sky,time,camera,fog,weather=weatherAt(time)){
  const palette=skyPalette(time,weather.cloudiness),uniforms=sky.material.uniforms;
  sky.position.copy(camera.position);uniforms.origin.value.set(camera.position.x,camera.position.z);
  uniforms.time.value=time;uniforms.light.value=palette.light;
  uniforms.cloudiness.value=weather.cloudiness;uniforms.sunlight.value=weather.sunlight;
  for(const key of ['horizon','zenith','cloud'])uniforms[key].value.copy(palette[key]);
  fog.color.copy(palette.horizon);
}
