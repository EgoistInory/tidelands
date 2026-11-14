import * as THREE from '../vendor/three.module.min.js';

// Shared HDR finish: small contact shadows and restrained light spill, with no downloaded assets.
export function createSceneFinish(renderer){
  if(!renderer.extensions.has('EXT_color_buffer_float'))return null;
  const color=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter});
  // Foliage alpha-to-coverage requires a multisampled target, matching the original canvas AA.
  color.samples=Math.min(4,renderer.capabilities.maxSamples);
  color.depthTexture=new THREE.DepthTexture(1,1,THREE.UnsignedIntType);
  const glow=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:false}),blur=glow.clone();
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute([-1,-1,0,3,-1,0,-1,3,0],3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,2,0,0,2],2));
  const scene=new THREE.Scene(),camera=new THREE.Camera(),quad=new THREE.Mesh(geometry);quad.frustumCulled=false;scene.add(quad);
  const vertexShader='varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position,1.0);}';
  const make=(fragmentShader,uniforms)=>new THREE.ShaderMaterial({vertexShader,fragmentShader,uniforms,depthTest:false,depthWrite:false});
  const bright=make(`varying vec2 vUv;uniform sampler2D source;uniform vec2 texel;
    vec3 highlight(vec2 uv){vec3 c=texture2D(source,uv).rgb;float l=max(max(c.r,c.g),c.b);return c*max(0.0,l-1.2)/max(l,.0001);}
    void main(){vec3 c=highlight(vUv+texel*vec2(-1,-1))+highlight(vUv+texel*vec2(1,-1))+highlight(vUv+texel*vec2(-1,1))+highlight(vUv+texel*vec2(1,1));gl_FragColor=vec4(c*.25,1.0);}`,
    {source:{value:color.texture},texel:{value:new THREE.Vector2()}});
  const soften=make(`varying vec2 vUv;uniform sampler2D source;uniform vec2 stepSize;
    void main(){vec3 c=texture2D(source,vUv).rgb*.4;c+=(texture2D(source,vUv+stepSize).rgb+texture2D(source,vUv-stepSize).rgb)*.24;c+=(texture2D(source,vUv+stepSize*2.0).rgb+texture2D(source,vUv-stepSize*2.0).rgb)*.06;gl_FragColor=vec4(c,1.0);}`,
    {source:{value:glow.texture},stepSize:{value:new THREE.Vector2()}});
  const composite=make(`varying vec2 vUv;uniform sampler2D source,depth,glow;uniform mat4 inverseProjection;uniform vec2 resolution,glowTexel;uniform float focal;
    vec3 positionAt(vec2 uv,float d){vec4 p=inverseProjection*vec4(uv*2.0-1.0,d*2.0-1.0,1.0);return p.xyz/p.w;}
    void main(){
      vec3 col=texture2D(source,vUv).rgb;float d=texture2D(depth,vUv).r;
      vec3 p=positionAt(vUv,d),normal=normalize(cross(dFdx(p),dFdy(p)));
      if(dot(normal,-p)<0.0)normal=-normal;
      float shade=0.0;
      if(d<.99999){
        vec2 radius=vec2(clamp(.8*focal/max(-p.z,.2),2.0,32.0))/resolution;
        for(int i=0;i<8;i++){
          float angle=float(i)*2.39996323;vec2 uv=vUv+vec2(cos(angle),sin(angle))*radius*(.4+.6*float(i+1)/8.0);
          float sd=texture2D(depth,uv).r;vec3 delta=positionAt(uv,sd)-p;float lengthTo=length(delta);
          float above=dot(normal,delta)-.045;
          shade+=smoothstep(.0,.18,above)*(1.0-smoothstep(.12,1.05,lengthTo))*step(sd,.99999);
        }
      }
      col*=1.0-min(.25,shade*.055);
      vec3 bloom=texture2D(glow,vUv).rgb*.4;
      bloom+=(texture2D(glow,vUv+vec2(0,glowTexel.y)).rgb+texture2D(glow,vUv-vec2(0,glowTexel.y)).rgb)*.24;
      bloom+=(texture2D(glow,vUv+vec2(0,glowTexel.y*2.0)).rgb+texture2D(glow,vUv-vec2(0,glowTexel.y*2.0)).rgb)*.06;
      col+=bloom*.16;
      gl_FragColor=vec4(col,1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,{source:{value:color.texture},depth:{value:color.depthTexture},glow:{value:blur.texture},inverseProjection:{value:new THREE.Matrix4()},resolution:{value:new THREE.Vector2()},glowTexel:{value:new THREE.Vector2()},focal:{value:1}});
  bright.toneMapped=soften.toneMapped=false;
  const size=new THREE.Vector2();let enabled=true,released=false;
  return {
    get enabled(){return enabled;},set enabled(value){enabled=!!value;},
    resize(width,height){if(released)return;color.setSize(width,height);const w=Math.max(1,Math.ceil(width/4)),h=Math.max(1,Math.ceil(height/4));glow.setSize(w,h);blur.setSize(w,h);bright.uniforms.texel.value.set(1/width,1/height);soften.uniforms.stepSize.value.set(1/w,0);composite.uniforms.resolution.value.set(width,height);composite.uniforms.glowTexel.value.set(1/w,1/h);},
    render(world,view){
      if(!enabled||released){renderer.render(world,view);return;}
      const previous=renderer.getRenderTarget();
      try{
        renderer.getDrawingBufferSize(size);if(color.width!==size.x||color.height!==size.y)this.resize(size.x,size.y);
        renderer.setRenderTarget(color);renderer.render(world,view);
        quad.material=bright;renderer.setRenderTarget(glow);renderer.render(scene,camera);
        quad.material=soften;renderer.setRenderTarget(blur);renderer.render(scene,camera);
        composite.uniforms.inverseProjection.value.copy(view.projectionMatrixInverse);composite.uniforms.focal.value=.5*color.height*view.projectionMatrix.elements[5];
        quad.material=composite;renderer.setRenderTarget(previous);renderer.render(scene,camera);
      }finally{renderer.setRenderTarget(previous);}
    },
    dispose(){if(released)return;released=true;for(const item of [color,glow,blur,geometry,bright,soften,composite])item.dispose();}
  };
}
