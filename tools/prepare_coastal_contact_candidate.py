"""Build an explicit isolated runtime revision; production and existing revisions remain intact."""
from pathlib import Path
import argparse
import hashlib
import json
import zipfile

ROOT=Path(__file__).resolve().parents[1]
def sha(data):return hashlib.sha256(data).hexdigest()
def prepare(revision):
    package=json.loads((ROOT/'dist/tidelands-m5-2026-10-27-cast-clothing.json').read_text())
    archive=ROOT/'dist'/package['archive'];assert sha(archive.read_bytes())==package['archiveSha256']
    dest=ROOT/'dist'/f'coastal-contact-{revision}'/'tidelands-local';assert not dest.exists(),'Preserve existing revision'
    sources={}
    with zipfile.ZipFile(archive) as source:
        for name,row in package['files'].items():
            data=source.read('tidelands-local/'+name);assert sha(data)==row['sha256']
            assert sha((ROOT/('docs/LOCAL-DELIVERY.md' if name=='README.md' else name)).read_bytes())==row['sha256']
            sources[name]=data
    helper=(ROOT/'tests/coastal-resource-footprint.js').read_text().replace("'../src/world.js'","'./world.js'").replace("'../src/action-timing.js'","'./action-timing.js'")
    sources['src/resource-footprint.js']=helper.encode()
    def replace(text,old,new):
        assert text.count(old)==1,(revision,old[:80]);return text.replace(old,new)
    if revision!='r0':
        game=sources['src/game.js'].decode()
        game="import {footprintBlocksMove,footprintIntersectsBuilding,copyFootprint} from './resource-footprint.js';\n"+game
        game=replace(game,'function resourceIntersectsBuilding(object,building){','function resourceIntersectsBuilding(object,building){\n  const contact=footprintIntersectsBuilding(object,building);if(contact!==null)return contact;')
        game=replace(game,"object:{id:object.id,x:object.x,z:object.z,type:object.type,scale:object.scale}","object:copyFootprint(object,{id:object.id,x:object.x,z:object.z,type:object.type,scale:object.scale})")
        old="(o.type==='tree'?actorBlocksMove(from,to,o,radius,1.15):resourceBlocksMove(from,to,o,radius))"
        game=replace(game,old,"(footprintBlocksMove(from,to,o,radius)??(o.type==='tree'?actorBlocksMove(from,to,o,radius,1.15):resourceBlocksMove(from,to,o,radius)))")
        sources['src/game.js']=game.encode()
        contact="import {footprintReach} from './resource-footprint.js';\n"+sources['src/resource-contact.js'].decode()
        contact=replace(contact,'export function resourceReachDistance(player,object){','export function resourceReachDistance(player,object){\n  const shaped=footprintReach(player,object);if(shaped!==null)return shaped;')
        sources['src/resource-contact.js']=contact.encode()
        if revision=='r2':
            main="import {footprintGatherTarget} from './resource-footprint.js';\n"+sources['src/main.js'].decode()
            main=replace(main,"view.gatherTarget={x:near.x,z:near.z,y:terrain(near.x,near.z)+.35};","view.gatherTarget=footprintGatherTarget(state.player,near)??{x:near.x,z:near.z,y:terrain(near.x,near.z)+.35};")
            main=replace(main,"state.player.yaw=Math.atan2(near.x-state.player.x,near.z-state.player.z);","state.player.yaw=Math.atan2(view.gatherTarget.x-state.player.x,view.gatherTarget.z-state.player.z);")
            sources['src/main.js']=main.encode()
            impact="import {footprintGatherTarget} from './resource-footprint.js';\n"+sources['src/impact-feedback.js'].decode()
            old="?cueAt(state,pending.object,pending.object.type):null;"
            new="?gatherCue(state,pending.object):null;"
            impact=replace(impact,old,new)
            impact+="\nfunction gatherCue(state,object){const cue=cueAt(state,object,object.type),point=footprintGatherTarget(state.player,object);return point?{...cue,...point,floor:terrain(point.x,point.z)}:cue;}\n"
            sources['src/impact-feedback.js']=impact.encode()
    for name,data in sources.items():
        target=dest/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data)
    # Browser fixtures reference this isolated core but keep source assets in the original ignored store.
    report=dict(revision=revision,path=str(dest),baseArchiveSha256=package['archiveSha256'],productionChanged=False,
                files={name:dict(bytes=len(data),sha256=sha(data)) for name,data in sources.items()},
                changed=[name for name,data in sources.items() if name not in package['files'] or sha(data)!=package['files'][name]['sha256']],
                ordinarySaveTouched=False,milestoneM5Complete=False,fullGoalComplete=False)
    (ROOT/'docs'/f'coastal-contact-{revision}-source.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({k:v for k,v in report.items() if k!='files'}))

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--revision',choices=['r0','r1','r2'],required=True)
    prepare(parser.parse_args().revision)
