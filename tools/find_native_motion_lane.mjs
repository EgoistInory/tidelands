// Choose an input lane on an independent copy, never relocate the running player.
import fs from 'node:fs';import {world,clearSegment} from './journey_path.mjs';import {bindCampaignContacts} from './campaign_contact_plan.mjs';
const state=JSON.parse(fs.readFileSync('docs/settlement-ground-2026-11-15/route-final-save.json')),contacts=bindCampaignContacts(world),yaw=.15,rows=[];
try{for(const [x,z,keys]of [[1,1,['d','s']],[-1,-1,['a','w']],[1,0,['d']],[-1,0,['a']],[0,1,['s']],[0,-1,['w']],[1,-1,['d','w']],[-1,1,['a','s']]]){
 const n=Math.hypot(x,z),dx=(x*Math.cos(yaw)+z*Math.sin(yaw))/n,dz=(-x*Math.sin(yaw)+z*Math.cos(yaw))/n;
 for(const length of [26,18,13]){const end={x:state.player.x+dx*length,z:state.player.z+dz*length};if(clearSegment(state,state.player,end)){rows.push({keys,length,start:{x:state.player.x,z:state.player.z},end});break;}}
}fs.writeFileSync('dist/native-motion-lanes-2026-11-15.json',JSON.stringify({rows,scope:'Read-only copied-state planner with shipped contact metadata; actual native traversal still required.'},null,2)+'\n');console.log(JSON.stringify(rows));}finally{contacts.release();}
