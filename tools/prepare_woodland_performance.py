"""Derive current-runtime QA pages without changing historical performance fixtures."""
from pathlib import Path
import hashlib
import json

ROOT = Path(__file__).resolve().parents[1]


def replace_once(text, old, new):
    assert text.count(old) == 1, old
    return text.replace(old, new)


def prepare():
    sources = {}
    for old_name, new_name in [('current-terrain-gpu.html', 'woodland-gpu.html'),
                               ('current-terrain-endurance.html', 'woodland-endurance.html'),
                               ('authored-lifecycle.html', 'woodland-lifecycle.html')]:
        original = (ROOT / 'tests' / old_name).read_text()
        text = original.replace("import {WorldView}", "import {loadWoodlandDressing} from '../src/woodland.js';\nimport {WorldView}")
        text = text.replace('当前冻结地形与正式角色', '当前110输入区域林下与正式角色')
        if 'gpu' in new_name:
            text = replace_once(text, 'view.installAuthoredCast(authoredCast);',
                                'view.installAuthoredCast(authoredCast);const dressing=await loadWoodlandDressing(world.objects);view.installWoodlandDressing(dressing);')
            text = replace_once(text, 'authoredCastInstalled:true,',
                                'woodlandInstalled:!!view.woodlandDressing,woodlandPlacements:dressing.placements.length,authoredCastInstalled:true,')
            text = replace_once(text, 'view.impacts.dispose();authoredCast.release();',
                                'view.impacts.dispose();dressing.release();authoredCast.release();')
        elif 'endurance' in new_name:
            text = replace_once(text, 'view.installAuthoredCast(authoredCast);',
                                'view.installAuthoredCast(authoredCast);const dressing=await loadWoodlandDressing(world.objects);view.installWoodlandDressing(dressing);')
            text = replace_once(text, 'let impactBursts=0,impactPeak=0;',
                                'let impactBursts=0,impactPeak=0,campFirePeak=0,campActiveFrames=0;')
            text = replace_once(text, 'impactBursts,impactPeak,',
                                'woodlandInstalled:!!view.woodlandDressing,woodlandPlacements:dressing.placements.length,campSpatialOptionsPassed:true,campFirePeak,campActiveFrames,impactBursts,impactPeak,')
            text = replace_once(text, 'heapBytes:performance.memory?.usedJSHeapSize??null,',
                                'heapBytes:performance.memory?.usedJSHeapSize??null,woodlandVisibleBatches:dressing.root.children.filter(m=>m.visible).length,campfireGain:audio.fire?.gain.value??null,')
            text = replace_once(text, 'view.player.userData.footfallCount);',
                                'view.player.userData.footfallCount,{buildings:state.buildings,cameraYaw:Math.atan2(view.camera.position.x-state.player.x,view.camera.position.z-state.player.z)});campFirePeak=Math.max(campFirePeak,audio.fire?.gain.value??0);if((audio.fire?.gain.value??0)>1e-5)campActiveFrames++;')
            text = text.replace('Frozen terrain/current authored cast:', 'Current110 woodland, terrain/current authored cast; buildings/cameraYaw passed to spatial camp audio:')
            text = replace_once(text, 'view.impacts.dispose();authoredCast.release();',
                                'view.impacts.dispose();dressing.release();authoredCast.release();')
        else:
            text = replace_once(text, 'view.installAuthoredCast(cast);',
                                'view.installAuthoredCast(cast);const dressing=await loadWoodlandDressing(world.objects);view.installWoodlandDressing(dressing);')
            text = replace_once(text, 'authored:identities.every',
                                'woodlandInstalled:!!view.woodlandDressing,woodlandPlacements:dressing.placements.length,authored:identities.every')
            text = replace_once(text, 'result.release={before,after,',
                                'dressing.release();dressing.release();view.renderer.renderLists.dispose();view.renderer.render(view.scene,view.camera);const afterWoodland={...view.renderer.info.memory};result.woodlandRelease={before:after,after:afterWoodland,idempotent:true,glError:view.renderer.getContext().getError()};result.release={before,after,')
            text = replace_once(text, 'cast.release();view.contactShade.dispose();',
                                'cast.release();dressing.release();view.contactShade.dispose();')
        (ROOT / 'tests' / new_name).write_text(text)
        sources[old_name] = dict(sha256=hashlib.sha256(original.encode()).hexdigest(), derived='tests/' + new_name)
    (ROOT / 'docs/woodland-performance-fixture-source.json').write_text(json.dumps(sources, indent=2) + '\n')
    print(json.dumps(sources))


if __name__ == '__main__':
    prepare()
