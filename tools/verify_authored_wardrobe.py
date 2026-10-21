"""Verify the isolated wardrobe evidence. A passed evidence audit does not accept game quality."""
import hashlib
import json
import math
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
if __name__ == '__main__':
    manifest = json.loads((ROOT / 'docs/authored-wardrobe-evidence.json').read_text())
    for filename, expected in manifest['files'].items():
        assert sha(ROOT / filename) == expected, filename
    staging = json.loads((ROOT / 'docs/authored-hair-staging.json').read_text())
    for name, row in staging['files'].items():
        path = ROOT / staging['stagedDirectory'] / name
        assert path.stat().st_size == row['bytes'] and sha(path) == row['sha256']
    assert len(staging['hairstyles']) == 4 and not staging['runtimeIntegrated']
    browser = json.loads((ROOT / 'docs/authored-wardrobe-browser.json').read_text())
    assert browser['console'] == [] and len(browser['rows']) == 13
    roles, frames = set(), 0
    for row in browser['rows']:
        s = row['state']; roles.add(s['model'])
        assert s['ready'] and not s['hidden'] and not s['running'] and s['glError'] == 0
        assert s['metadata']['restRetargeted'] and not s['metadata']['productionIntegrated']
        assert len(s['metadata']['jointNames']) == 65 and len(s['metadata']['offeredClips']) == 43
        assert (ROOT / row['image']).read_bytes().startswith(b'\xff\xd8\xff')
        if row['kind'] == 'motion':
            assert s['frames'] == 180 and len(s['poses']) == 6 and s['raf']['samples'] == 179
            assert all(math.isfinite(v) for p in s['poses'] for xyz in p['joints'].values() for v in xyz)
            frames += 180
    assert roles == {'traveler', 'keeper', 'botanist', 'explorer'} and frames == 1260
    assert any(r['state']['viewport'] == [390,844] for r in browser['rows'])
    cpu = json.loads((ROOT / 'docs/authored-wardrobe-cpu.json').read_text())
    for filename, expected in cpu['files'].items(): assert sha(ROOT / filename) == expected
    assert len(cpu['rows']) == 4 and all(r['poses'] == 430 and r['clips'] == 43 and r['sourcePositionsUnchanged'] and r['sourceWeightsNormalized'] for r in cpu['rows'])
    assert '# pass 263' in (ROOT / 'docs/authored-wardrobe-full-tests.txt').read_text()
    assert '# fail 0' in (ROOT / 'docs/authored-wardrobe-full-tests.txt').read_text()
    assert '# pass 6' in (ROOT / 'docs/authored-wardrobe-tests.txt').read_text()
    assert sha(ROOT / 'dist/tidelands-m5-2026-10-18-beacon-footing.zip') == '2d922da8581be03234e0b721cf7f5561b8d0612a5093ac55f82b5330b33ae5ca'
    assert sha(ROOT / 'docs/beacon-footing-normal-save.json') == '33455473ff0e92097db6351e2ea421e498accde405ee5a9482ae8ef16d55bb29'
    result = {'passed': True, 'scope': 'Evidence completeness of isolated wardrobe and rest retarget candidate only', 'roles': sorted(roles),
              'visualRows': 13, 'motionFrames': frames, 'offlinePoses': 1720, 'offlineVertexSamples': 258000,
              'sourceFiles': manifest['files'], 'swimStandingFloorOcclusionObserved': True,
              'runtimeIntegrated': False, 'outfitDelivered': False, 'swimHeightAccepted': False,
              'gameTimingEquipmentAccepted': False, 'footSupportAccepted': False, 'textureBudgetAccepted': False,
              'gameGpuOrEnduranceAccepted': False, 'fullM5Complete': False, 'fullGoalComplete': False}
    (ROOT / 'docs/authored-wardrobe-audit.json').write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({k:v for k,v in result.items() if k != 'sourceFiles'}))
