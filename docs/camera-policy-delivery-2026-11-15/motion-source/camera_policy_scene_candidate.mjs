// Response-only QA adapter. Never imported by production or included in a delivery package.
export function cameraPolicyScene(source){
 const original="    const safe=unobstructedCamera(",start=source.indexOf(original),end=source.indexOf('    // A retracted camera',start);if(start<0||end<0)throw Error('Camera splice markers changed');
 source=source.slice(0,start)+`    if(window.cameraPolicyActive){
      const began=performance.now();this.cameraRoute??={};
      const result=followCameraCandidate(focus,this.camera.position,target,boxes,terrain,dt,this.cameraRoute);
      this.camera.position.copy(result.position);this.cameraPolicyResult={...result,position:result.position.toArray(),inside:boxes.some(b=>b.containsPoint(result.position))};
      this.cameraFade??=createForegroundFade();for(const root of cameraOccluderRoots(this))prepareCameraOccluder(root);
      const body=focus.clone();body.y-=1;this.cameraFade.update(body,this.camera.position,result.occluded,dt);this.cameraPolicyCost=performance.now()-began;
    }else{
      this.cameraFade?.reset();const safe=unobstructedCamera(focus,target,boxes,terrain,6,renderedYaw);
      this.camera.position.copy(smoothCamera(focus,this.camera.position,safe,boxes,terrain,dt,Math.min(6,safe.distanceTo(focus))));
    }
`+source.slice(end);
 const marker='for(const o of LANDMARKS){const g=landmarkModel(o,this.rockSurface);';if(!source.includes(marker))throw Error('Landmark ownership marker changed');
 source=source.replace(marker,marker+"if(o.type!=='npc'){this.cameraForegroundRoots??=[];this.cameraForegroundRoots.push(g);}");
 return "import {followCameraCandidate} from '/tools/camera_controller_candidate.js';import {prepareCameraOccluder,createForegroundFade,cameraOccluderRoots} from '/tools/camera_occlusion_candidate.js';\n"+source;
}
