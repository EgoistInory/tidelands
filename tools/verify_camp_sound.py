"""Verify bounded camp ambience wiring, native evidence and local package integrity."""
from pathlib import Path
import array
import hashlib
import json
import re
import sys
import wave
import zipfile

ROOT = Path(__file__).resolve().parents[1]
NAME = 'tidelands-m5-2026-10-24-camp-sound'
load = lambda p: json.loads((ROOT / p).read_text())
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()


def verify():
    p = load('dist/' + NAME + '.json')
    old = load('dist/tidelands-m5-2026-10-24-action-sound.json')
    unpack = load('docs/' + NAME + '-verification.json')
    assert p['archiveBytes'] == 15063204 and p['archiveEntries'] == 95 and len(p['files']) == 94
    assert unpack['passed'] and unpack['checkedFiles'] == 94
    assert sha(ROOT / 'dist' / p['archive']) == p['archiveSha256'] == unpack['archiveSha256']
    assert sha(ROOT / 'dist' / old['archive']) == old['archiveSha256']
    assert p['builderSha256'] == old['builderSha256'] == sha(ROOT / 'tools/package_local.py')
    changed = [n for n, r in p['files'].items() if r['sha256'] != old['files'][n]['sha256']]
    assert changed == ['README.md', 'src/audio.js', 'src/main.js']
    with zipfile.ZipFile(ROOT / 'dist' / p['archive']) as archive:
        assert len(archive.infolist()) == 95 and archive.testzip() is None
        for n, row in p['files'].items():
            source = ROOT / ('docs/LOCAL-DELIVERY.md' if n == 'README.md' else n)
            assert sha(source) == sha(Path(unpack['extractedPath']) / n) == row['sha256'], n
            assert hashlib.sha256(archive.read('tidelands-local/' + n)).hexdigest() == row['sha256'], n
    with zipfile.ZipFile(ROOT / 'dist' / old['archive']) as archive:
        before = archive.read('tidelands-local/src/main.js').decode()
        call = 'view.player.userData.footfallCount);'
        replacement = 'view.player.userData.footfallCount,{buildings:state.buildings,cameraYaw:Math.atan2(view.camera.position.x-state.player.x,view.camera.position.z-state.player.z)});'
        assert before.count(call) == 1 and before.replace(call, replacement) == (ROOT / 'src/main.js').read_text()
        prior = archive.read('tidelands-local/src/audio.js').decode()
        current = (ROOT / 'src/audio.js').read_text()
        assert prior.split('  effect(', 1)[1].split('  update(', 1)[0] == current.split('  effect(', 1)[1].split('  update(', 1)[0]
    evidence = load('docs/camp-sound-main-browser.json')
    assert evidence['console'] == [] and len(evidence['rows']) == 5
    rows = {r['name']: r for r in evidence['rows']}
    for row in rows.values():
        for n, digest in row['sources'].items():
            assert sha(ROOT / n) == digest, n
        assert row['glError'] == 0 and row['buildingCount'] == 3 and row['actualFireMeshes'] == 1
        assert row['fireLoop'] and row['fireBufferSeconds'] == 4 and row['updates'] > 0
        assert len(row['worldInput']['buildings']) == 3
    assert rows['night-start']['player']['hp'] == 63 and rows['night-rest']['player']['hp'] == 100
    assert rows['night-start']['fireLight'] > 0 and rows['night-start']['fireGain'] > .17
    assert rows['night-pause']['paused'] and not rows['night-pause']['active'] and rows['night-pause']['master'] == 0
    assert rows['night-resume']['active'] and not rows['night-resume']['paused'] and rows['night-resume']['master'] > .3
    assert rows['day-mobile-start']['viewport'] == [390, 844] and rows['day-mobile-start']['voices'] == 0
    pcm = load('docs/camp-sound-pcm-browser.json')
    assert pcm['complete'] and pcm['console'] == [] and pcm['disposed'] and pcm['remainingBeforeDispose'] == 0
    assert pcm['sourceSha256'] == sha(ROOT / 'src/audio.js') and pcm['rate'] == 48000 and pcm['seconds'] == 20
    windows = {w['stage']: w for w in pcm['windows']}
    assert windows['near-right']['right']['rms'] > windows['near-right']['left']['rms'] * 5
    assert windows['near-left']['left']['rms'] > windows['near-left']['right']['rms'] * 5
    assert windows['far']['right']['rms'] < windows['near-right']['right']['rms'] * .5
    assert windows['no-fire']['right']['rms'] < windows['near-right']['right']['rms'] * .01
    for stage in ['paused', 'muted']:
        assert all(windows[stage][c]['rms'] == windows[stage][c]['peak'] == 0 for c in ['left', 'right'])
    with wave.open(str(ROOT / 'docs/camp-sound-spatial.wav'), 'rb') as f:
        assert (f.getnchannels(), f.getsampwidth(), f.getframerate(), f.getnframes()) == (2, 2, 48000, 960000)
        samples = array.array('h', f.readframes(f.getnframes()))
        if sys.byteorder != 'little':
            samples.byteswap()
        assert 0 < pcm['peak'] < 1 and abs(max(abs(v) for v in samples) / 32767 - pcm['peak']) < 1 / 32767
    ordinary = load('docs/camp-sound-package-browser.json')
    assert ordinary['console'] == [] and 'progress indicator Value: 79, ID: hp' in ordinary['ax']
    assert '群岛，再次相连' in ordinary['ax'] and '位置 X 7.2，Z 53.5；建筑 1；击败 3' in ordinary['ax']
    for item, count in [('木材', 4), ('石料', 5), ('纤维', 6), ('浆果', 3), ('贝壳', 0), ('晶石', 0), ('石斧', 1), ('晶石剑', 0), ('烤浆果', 0)]:
        assert re.search(r'text ' + item + r'\n\s+\d+ text ' + str(count) + r'\n', ordinary['bagAx'])
    assert sha(ROOT / 'docs/beacon-footing-normal-save.json') == '33455473ff0e92097db6351e2ea421e498accde405ee5a9482ae8ef16d55bb29'
    for label, count in [('focused', 29), ('full-tests', 310)]:
        log = (ROOT / ('docs/camp-sound-' + label + '.txt')).read_text()
        assert '# tests ' + str(count) + '\n' in log and '# fail 0\n' in log
    assert '# fail 2\n' in (ROOT / 'docs/camp-sound-red.txt').read_text()
    images = sorted((ROOT / 'docs').glob('camp-sound-*.jpg'))
    assert len(images) == 3 and all(n.read_bytes()[:2] == b'\xff\xd8' for n in images)
    files = [*sorted((ROOT / 'docs').glob('camp-sound-*')), *sorted((ROOT / 'tests').glob('camp-sound*')),
             ROOT / 'tools/verify_camp_sound.py', ROOT / 'docs/CAMP-SOUND-DELIVERY.md',
             ROOT / ('docs/' + NAME + '-verification.json')]
    files = [n for n in files if n.name != 'camp-sound-audit.json']
    report = dict(verified=True, boundedCampAmbienceDelivered=True, archive=p['archive'], archiveSha256=p['archiveSha256'],
                  archiveBytes=p['archiveBytes'], changedInputs=changed, runtimeInputs=94, extractedPath=unpack['extractedPath'],
                  focusedTests=29, fullTests=310, imagesViewed=3, pcmSeconds=20, pcmPeak=pcm['peak'],
                  ordinaryDesktopRestored=True, ordinary390ReloadRestored=False, ordinaryNewJsonExported=False,
                  graphicsRuntimeSourcesUnchanged=True, currentExactSourceGpuAccepted=False, currentExactSourceEnduranceAccepted=False,
                  audibleQualityAccepted=False, completeMixAccepted=False, milestoneM5Complete=False, fullGoalComplete=False,
                  scope='One fixed-budget spatial camp layer, native rest/pause/resume and isolated stereo PCM. Not final audition, mixed-world PCM, device, ordinary continuous campaign or exact-source endurance proof.',
                  files={str(n.relative_to(ROOT)): sha(n) for n in files})
    (ROOT / 'docs/camp-sound-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({k: report[k] for k in ['verified', 'boundedCampAmbienceDelivered', 'archiveSha256', 'fullGoalComplete']}))


if __name__ == '__main__':
    verify()
