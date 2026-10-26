"""Verify source and ordinary-save evidence; visual quality remains a manual judgment."""
from pathlib import Path
import hashlib
import json
import math
import zipfile

ROOT = Path(__file__).resolve().parents[1]
PREFIX = 'overall-experience-20261027'


def load(suffix):
    return json.loads((ROOT / 'docs' / (PREFIX + suffix)).read_text())


def verify():
    digest = lambda data: hashlib.sha256(data).hexdigest()
    package = json.loads((ROOT / 'dist/tidelands-m5-2026-10-27-cast-clothing.json').read_text())
    archive = ROOT / 'dist' / package['archive']
    assert digest(archive.read_bytes()) == package['archiveSha256']
    assert len(package['files']) == 110
    with zipfile.ZipFile(archive) as bundle:
        for name, record in package['files'].items():
            source = ROOT / ('docs/LOCAL-DELIVERY.md' if name == 'README.md' else name)
            assert digest(source.read_bytes()) == record['sha256'], name
            assert digest(bundle.read('tidelands-local/' + name)) == record['sha256'], name
    before, reloaded, saved, restored = [load('-' + name + '.json') for name in
                                        ['before', 'reloaded', 'saved', 'restored']]
    fields = ['player', 'inventory', 'quest', 'kills', 'buildings', 'depleted', 'selected', 'respawn', 'time']
    for key in fields:
        assert before[key] == reloaded[key], ('initial reload', key)
        assert saved[key] == restored[key], ('final reload', key)
    for key in ['inventory', 'quest', 'kills', 'buildings', 'selected', 'respawn']:
        assert before[key] == saved[key], ('ordinary progress preserved', key)
    assert before['player']['hp'] == saved['player']['hp'] == 100
    assert saved['quest'] == 6 and saved['kills'] == 3
    assert restored['viewport'] == restored['buffer'] == [390, 844]
    assert 'initialState' not in (ROOT / 'tests/current-ordinary-journey.html').read_text()
    rows = [json.loads(line) for line in (ROOT / 'docs' / (PREFIX + '-input.jsonl')).read_text().splitlines()]
    assert [(row['action'], row['durationMs']) for row in rows] == [
        ('d', 1500), ('d', 1000), ('e', 650), ('w', 2000),
        ('s', 3000), ('a', 2300), ('e', 650), ('space', 650)]
    assert rows[2]['state']['near']['id'] == 'keeper'
    assert rows[6]['before']['near']['type'] == 'campfire'
    assert rows[6]['before']['player']['hp'] == rows[6]['state']['player']['hp'] == 100
    assert all(row['state']['glError'] == 0 for row in rows)
    distance, previous = 0, reloaded
    for row in rows:
        start = row.get('before', previous)['player']
        end = row['state']['player']
        distance += math.hypot(end['x'] - start['x'], end['z'] - start['z'])
        previous = row['state']
    assert 65 < distance < 80
    assert rows[-1]['state']['inventory'] == rows[-1]['before']['inventory']
    assert rows[-1]['state']['kills'] == rows[-1]['before']['kills']
    scenes = load('-scenes.json')
    assert [row['scene'] for row in scenes] == ['coast', 'grove', 'highland', 'shoal', 'camp']
    assert all(row['art'] == 'candidate' and row['worldUnchanged'] and row['glError'] == 0 for row in scenes)
    assert all(row['viewport'] == [1280, 720] and row['buffer'] == [1920, 1080] for row in scenes)
    assert [row['time'] for row in scenes] == [240, 240, 240, 240, 0]
    assert load('-console.json') == []
    images = sorted((ROOT / 'docs').glob(PREFIX + '-*.jpg'))
    assert len(images) == 14 and all(path.stat().st_size > 10000 for path in images)
    report = dict(verified=True, sourceUnchanged=True, runtimeInputs=110,
                  archiveSha256=package['archiveSha256'], ordinaryGameplayKeyRecords=8,
                  heldGameplayInputMs=sum(row['durationMs'] for row in rows),
                  inputEndpointMovementMetres=distance,
                  simulationClockSpan=saved['time'] - before['time'],
                  ordinaryNpcCompletionDialogueObserved=True, ordinaryCampRestAtFullHealth=True,
                  nativeEmptyAttackObserved=True, initialReloadAndFinal390ReloadMatched=True,
                  fullInputTrace=False, controllerPausesUsed=True, injectedOrdinaryState=False,
                  fixedSceneFixtures=5, nativeImagesManuallyViewed=14,
                  images={path.name: digest(path.read_bytes()) for path in images},
                  currentFullCampaignReplayed=False, frameByFrameMotionAccepted=False,
                  currentGpuOrEnduranceAccepted=False, audioListening=False,
                  realDeviceVerified=False, milestoneM5Complete=False, fullGoalComplete=False)
    (ROOT / 'docs' / (PREFIX + '-audit.json')).write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({key: value for key, value in report.items() if key != 'images'}))


if __name__ == '__main__':
    verify()
