// QA-only bounded event history. No production imports or state writes.
export function createCombatObservation(limit=2400){
 if(!Number.isInteger(limit)||limit<2)throw Error('Invalid frame limit');
 const frames=[];let previous=null,dropped=0;
 return {
  record(frame){
   const copy=structuredClone(frame);
   copy.changes=[];
   if(previous){
    if(copy.player.hp!==previous.player.hp)copy.changes.push({kind:'player-hp',before:previous.player.hp,after:copy.player.hp});
    const old=new Map(previous.enemies.map(e=>[e.id,e.hp]));
    for(const e of copy.enemies)if(old.has(e.id)&&old.get(e.id)!==e.hp)copy.changes.push({kind:'enemy-hp',id:e.id,before:old.get(e.id),after:e.hp});
   }
   if(frames.length===limit){frames.shift();dropped++;}
   frames.push(copy);previous=copy;
  },
  snapshot(){return structuredClone({frames,dropped});}
 };
}
