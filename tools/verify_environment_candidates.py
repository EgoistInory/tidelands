"""Audit rejected prop mass and pending coherent terrain evidence; production must remain intact."""
from pathlib import Path
import hashlib
import json
import zipfile

ROOT = Path(__file__).resolve().parents[1]
load = lambda p: json.loads((ROOT / p).read_text())
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()


def verify():
    mass = load('docs/regional-outcrop-candidate-browser.json')
    topo = load('docs/terrain-composition-browser.json')
    source = load('docs/terrain-composition-source.json')
    assert not mass['accepted'] and mass['console'] == [] and len(mass['rows']) == 8
    assert topo['console'] == dict(baseline=[], candidate=[]) and len(topo['rows']) == 9
    for data, prefix in [(mass, 'regional-outcrop-candidate'), (topo, 'terrain-composition')]:
        rows = {r['name']: r for r in data['rows']}
        for place in ['coast', 'forest', 'highland', 'shoal']:
            a, b = rows[place + '-baseline'], rows[place + '-candidate']
            for key in ['position', 'camera', 'time', 'weather', 'viewport', 'buffer', 'canvas']:
                assert a[key] == b[key], (prefix, place, key)
        for row in rows.values():
            assert row['glError'] == 0 and not row['running'] and not row['hidden']
            for n, digest in row['sources'].items():
                path = Path(source['path']) / n if prefix == 'terrain-composition' and '-candidate' in row['name'] else ROOT / n
                assert sha(path) == digest, str(path)
        pictures = sorted((ROOT / 'docs').glob(prefix + '-*.jpg'))
        assert len(pictures) == len(rows) and all(p.read_bytes()[:2] == b'\xff\xd8' for p in pictures)
    budget = mass['rows'][0]['budget']
    assert (budget['stoneNodes'], budget['fernInstances'], budget['tallFernInstances']) == (88, 5649, 2784)
    assert all(max(abs(b['min'][i]), abs(b['max'][i])) < 2.8 for b in budget['solidLocalBounds'] for i in [0, 2])
    assert max(b['max'][1] for b in budget['solidLocalBounds']) < 3.5
    move = topo['rows'][-1]
    assert move['frames'] == 180 and abs(move['distance'] - 18.55) < .0001
    candidate = Path(source['path'])
    assert sha(candidate / 'src/world.js') == source['candidateWorldSha256']
    assert sha(candidate / 'src/terrain-composition-candidate.js') == source['candidateHelperSha256'] == sha(ROOT / 'tests/terrain-composition-candidate.js')
    package = load('dist/tidelands-m5-2026-10-24-hud-field.json')
    assert sha(ROOT / 'dist' / package['archive']) == source['baseArchiveSha256'] == package['archiveSha256']
    with zipfile.ZipFile(ROOT / 'dist' / package['archive']) as archive:
        for n, row in package['files'].items():
            assert sha(ROOT / ('docs/LOCAL-DELIVERY.md' if n == 'README.md' else n)) == row['sha256'], n
            if n != 'src/world.js':
                assert sha(candidate / n) == row['sha256'], n
        before = archive.read('tidelands-local/src/world.js').decode()
        expected = "import {landformOffset} from './terrain-composition-candidate.js';\n" + before.replace('export function terrain(x,z){', 'function previousTerrain(x,z){')
        expected += '\nconst protectedCompositionSites=[SPAWN,...LANDMARKS];\nexport function terrain(x,z){const base=previousTerrain(x,z);return base+landformOffset(x,z,base,ISLANDS,protectedCompositionSites);}\n'
        assert (candidate / 'src/world.js').read_text() == expected
    for file, tests, fails, detail in [
        ('red', 3, 1, 'region 0: 0..0'), ('focused', 32, 1, 'pelvis=-0.8295677167551672'),
        ('slope-check', 4, 1, 'pelvis=-0.7007747614880603'), ('candidate-check', 3, 0, ''), ('production-tests', 310, 0, '')]:
        log = (ROOT / ('docs/terrain-composition-' + file + '.txt')).read_text()
        assert '# tests ' + str(tests) + '\n' in log and '# fail ' + str(fails) + '\n' in log and detail in log
    assert sha(ROOT / 'docs/beacon-footing-normal-save.json') == '33455473ff0e92097db6351e2ea421e498accde405ee5a9482ae8ef16d55bb29'
    files = [*sorted((ROOT / 'docs').glob('regional-outcrop-candidate-*')), *sorted((ROOT / 'docs').glob('terrain-composition-*')),
             ROOT / 'tests/environment-mass-candidate.js', ROOT / 'tests/environment-mass-review.html',
             *sorted((ROOT / 'tests').glob('terrain-composition-*')),
             ROOT / 'docs/REGIONAL-OUTCROP-CANDIDATE-PLAN.md', ROOT / 'docs/REGIONAL-OUTCROP-CANDIDATE-REVIEW.md',
             ROOT / 'docs/TERRAIN-COMPOSITION-CHECKPOINT.md', ROOT / 'tools/prepare_terrain_candidate.py', ROOT / 'tools/verify_environment_candidates.py']
    report = dict(verified=True, propMassAccepted=False, terrainCandidatePending=True, productionIntegrated=False,
                  imagesViewed=17, terrainMovementFrames=180, terrainMovementDistance=move['distance'],
                  terrainRegressionUnresolved=True, failedIntegrationRuns=2, restoredProductionTests=310,
                  newCandidateContracts=3, productionInputsUnchanged=94, fullGoalComplete=False, milestoneM5Complete=False,
                  candidateSource=source, gpuAccepted=False, ordinaryJourneyAccepted=False,
                  files={str(p.relative_to(ROOT)): sha(p) for p in files if p.name != 'environment-candidates-audit.json'})
    (ROOT / 'docs/environment-candidates-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({k: report[k] for k in ['verified', 'terrainCandidatePending', 'terrainRegressionUnresolved', 'productionIntegrated', 'fullGoalComplete']}))


if __name__ == '__main__':
    verify()
