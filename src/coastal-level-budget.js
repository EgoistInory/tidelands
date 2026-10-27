// Bounded candidate profile. World/contact records remain untouched.
export function coastalBudgetLevels(rows,player,depleted){
  let near=0,mid=0;
  return rows.map(row=>({id:row.id,d:Math.hypot(row.x-player.x,row.z-player.z)}))
    .sort((a,b)=>a.d-b.d||a.id.localeCompare(b.id)).map(row=>{
      let level='far';
      if(row.d>260||depleted.has(row.id))level='hidden';
      else if(row.d<12&&near<1){level='near';near++;}
      else if(row.d<32&&mid<3){level='mid';mid++;}
      return {id:row.id,level};
    });
}
