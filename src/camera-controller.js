// Keep lens motion connected; foreground visibility is handled by the renderer.
import * as T from '../vendor/three.module.min.js';
export function followCamera(focus,current,desired,boxes,heightAt,dt,route={}){
 const step=Math.max(0,Math.min(.05,dt)),margin=.05;
 const valid=p=>p.toArray().every(Number.isFinite)&&p.y>=heightAt(p.x,p.z)+.35&&p.distanceTo(focus)>2&&!boxes.some(b=>b.containsPoint(p));
 function segment(a,b){
  if(!valid(b))return false;const length=a.distanceTo(b);if(length<1e-8)return true;
  const ray=new T.Ray(a,b.clone().sub(a).normalize()),hit=new T.Vector3();
  for(const box of boxes)if(ray.intersectBox(box,hit)&&a.distanceTo(hit)<length-1e-6)return false;
  for(let n=1,count=Math.max(1,Math.ceil(length/.25));n<=count;n++){const p=a.clone().lerp(b,n/count);if(p.y<heightAt(p.x,p.z)+.35)return false;}
  return true;
 }
 function project(point){
  if(valid(point))return point.clone();const candidates=[],up=point.clone();up.y=Math.max(up.y,heightAt(up.x,up.z)+.4);candidates.push(up);
  for(const box of boxes)if(box.containsPoint(point))for(const axis of ['x','y','z'])for(const edge of [box.min[axis]-margin,box.max[axis]+margin]){const p=point.clone();p[axis]=edge;candidates.push(p);}
  for(const radius of [.5,1,2,4,8,16])for(let i=0;i<8;i++)for(const y of [-.7,0,.7]){const p=point.clone().add(new T.Vector3(Math.sin(i*Math.PI/4),y,Math.cos(i*Math.PI/4)).normalize().multiplyScalar(radius));p.y=Math.max(p.y,heightAt(p.x,p.z)+.4);candidates.push(p);}
  return candidates.filter(valid).sort((a,b)=>a.distanceToSquared(point)-b.distanceToSquared(point))[0]??null;
 }
 function blocked(a,b){const length=a.distanceTo(b),ray=new T.Ray(a,b.clone().sub(a).normalize()),hit=new T.Vector3();let closest=Infinity,found=null;
  for(const box of boxes)if(ray.intersectBox(box,hit)){const d=a.distanceTo(hit);if(d<length&&d<closest){closest=d;found=box;}}return found;
 }
 function terrainOccluded(p){const length=focus.distanceTo(p);for(let n=1,count=Math.max(1,Math.ceil(length/.25));n<count;n++){const q=focus.clone().lerp(p,n/count);if(q.y<heightAt(q.x,q.z)+.2)return true;}return false;}
 function occluded(p){if(boxes.some(b=>b.containsPoint(focus)))return true;return !!blocked(focus,p);}
 const focusJump=route.reset||(route.focus&&route.focus.distanceTo(focus)>32);delete route.reset;route.focus=focus.clone();
 const start=project(focusJump?desired:current);if(!start)return {position:current.clone(),occluded:true,recovered:false,unresolved:true};
 if(focusJump||start.distanceTo(current)>1e-6){delete route.waypoint;return {position:start,occluded:occluded(start),terrainOccluded:terrainOccluded(start),recovered:true,unresolved:terrainOccluded(start)};}
 // Solve the terrain profile along the requested bearing; rise gradually rather than switch orbit sides.
 const raised=desired.clone(),length=focus.distanceTo(raised),samples=Math.max(1,Math.ceil(length/.25));
 for(let n=1;n<samples;n++){const t=n/samples,x=focus.x+(raised.x-focus.x)*t,z=focus.z+(raised.z-focus.z)*t;raised.y=Math.max(raised.y,focus.y+(heightAt(x,z)+.4-focus.y)/t);}
 raised.y=Math.min(raised.y,Math.max(desired.y,focus.y+40));
 const goal=project(raised)??start;
 if(segment(start,goal))delete route.waypoint;
 else if(!route.waypoint||start.distanceTo(route.waypoint)<.15||!segment(start,route.waypoint)){
  delete route.waypoint;const box=blocked(start,goal),candidates=[];
  // Adjacent walls can cover the first box's corners. Include their outside corners without treating their empty interior as solid.
  const neighbors=box?boxes.filter(b=>b!==box&&b.intersectsBox(box.clone().expandByScalar(3))).sort((a,b)=>a.distanceToPoint(start)-b.distanceToPoint(start)).slice(0,7):[];
  for(const obstacle of box?[box,...neighbors]:[])for(const x of [obstacle.min.x-margin,obstacle.max.x+margin])for(const z of [obstacle.min.z-margin,obstacle.max.z+margin])for(const y of [start.y,obstacle.max.y+margin])candidates.push(new T.Vector3(x,Math.max(y,heightAt(x,z)+.4),z));
  const possible=candidates.filter(p=>p.distanceTo(start)>.15&&segment(start,p));possible.sort((a,b)=>(start.distanceTo(a)+a.distanceTo(goal))-(start.distanceTo(b)+b.distanceTo(goal)));route.waypoint=possible[0];
 }
 const aim=route.waypoint??goal,distance=start.distanceTo(aim),budget=Math.min(14*step,start.distanceTo(focus)*Math.tan(step*Math.PI*2/3));let next=start.clone();
 if(distance>1e-8){const a=new T.Spherical().setFromVector3(start.clone().sub(focus)),b=new T.Spherical().setFromVector3(aim.clone().sub(focus)),turn=Math.atan2(Math.sin(b.theta-a.theta),Math.cos(b.theta-a.theta)),fraction=Math.min(1,step*Math.PI*2/3/Math.max(Math.abs(turn),Math.abs(b.phi-a.phi),1e-8));
  a.theta+=turn*fraction;a.phi+=(b.phi-a.phi)*fraction;a.radius+=Math.max(-14*step,Math.min(14*step,b.radius-a.radius));
  const arc=new T.Vector3().setFromSpherical(a).add(focus),proposed=start.clone().lerp(arc,Math.min(1,budget/Math.max(1e-8,start.distanceTo(arc)))),linear=start.clone().lerp(aim,Math.min(1,budget/distance));
  if(segment(start,proposed))next=proposed;else if(segment(start,linear))next=linear;else{
  const candidates=[];for(const axes of [['x'],['y'],['z'],['x','y'],['x','z'],['y','z']]){const p=start.clone();for(const axis of axes)p[axis]=proposed[axis];if(segment(start,p))candidates.push(p);}candidates.sort((a,b)=>a.distanceToSquared(aim)-b.distanceToSquared(aim));next=candidates[0]??start;
 }}
 const groundOccluded=terrainOccluded(next);return {position:next,occluded:occluded(next),terrainOccluded:groundOccluded,recovered:false,unresolved:!valid(next)||groundOccluded};
}
