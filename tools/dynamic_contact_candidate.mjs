// Exact, bounded adapter for isolated Node/browser experiments. Leaves static contacts alone.
export function applyDynamicContactCandidate(source,moduleURL){
 const substitutions=[
 ['actorBlocksMove(from,to,state.player,radius)','actorBlocksMove3D(from,to,state.player,terrain,radius)'],
 ['o!==mover&&o.hp>0&&actorBlocksMove(from,to,o,radius)','o!==mover&&o.hp>0&&actorBlocksMove3D(from,to,o,terrain,radius)']
 ];
 for(const [before,after] of substitutions){if(source.split(before).length!==2)throw Error('Dynamic contact source contract changed');source=source.replace(before,after);}
 return `import {actorBlocksMove3D} from ${JSON.stringify(moduleURL)};\n`+source;
}
