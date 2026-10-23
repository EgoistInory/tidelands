"""Verify action identity, native game results, PCM and the local delivery."""
from pathlib import Path
import array
import hashlib
import json
import re
import sys
import wave
import zipfile

ROOT = Path(__file__).resolve().parents[1]
NAME = 'tidelands-m5-2026-10-24-action-sound'
load = lambda p: json.loads((ROOT / p).read_text())
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()


def verify():
    package = load('dist/' + NAME + '.json')
    prior = load('dist/tidelands-m5-2026-10-23-creature-surfaces.json')
    unpack = load('docs/' + NAME + '-verification.json')
    assert package['archiveBytes'] == 15062577 and package['archiveEntries'] == 95
    assert len(package['files']) == unpack['checkedFiles'] == 94 and unpack['passed']
    assert sha(ROOT / 'dist' / package['archive']) == package['archiveSha256'] == unpack['archiveSha256']
    assert package['builderSha256'] == prior['builderSha256'] == sha(ROOT / 'tools/package_local.py')
    changed = [p for p, row in package['files'].items() if row['sha256'] != prior['files'][p]['sha256']]
    assert changed == ['README.md', 'src/audio.js', 'src/main.js']
    with zipfile.ZipFile(ROOT / 'dist' / package['archive']) as archive:
        assert len(archive.infolist()) == 95 and archive.testzip() is None
        for p, row in package['files'].items():
            current = ROOT / ('docs/LOCAL-DELIVERY.md' if p == 'README.md' else p)
            assert sha(current) == sha(Path(unpack['extractedPath']) / p) == row['sha256'], p
            assert hashlib.sha256(archive.read('tidelands-local/' + p)).hexdigest() == row['sha256'], p
    assert sha(ROOT / 'dist' / prior['archive']) == prior['archiveSha256']
    with zipfile.ZipFile(ROOT / 'dist' / prior['archive']) as old:
        main = old.read('tidelands-local/src/main.js').decode()
        substitutions = [("audio.effect('gather');", "audio.effect('gather',{surface:cue.kind});"),
                         ("audio.effect('swing');", "audio.effect('swing',{weapon:state.selected});"),
                         ("if(r.hits.length)audio.effect('hit');", "if(r.hits.length)audio.effect('hit',{enemyType:state.enemies.find(e=>e.id===r.hits[0])?.type});"),
                         ("view.hurtAt=state.time;audio.effect('hit');", "view.hurtAt=state.time;audio.effect('hurt');")]
        for a, b in substitutions:
            assert main.count(a) == 1
            main = main.replace(a, b)
        assert main == (ROOT / 'src/main.js').read_text()
        audio = old.read('tidelands-local/src/audio.js').decode()
        now = (ROOT / 'src/audio.js').read_text()
        assert audio.split('  effect(', 1)[0] == now.split('  effect(', 1)[0]
        assert audio.split('  update(', 1)[1] == now.split('  update(', 1)[1]
    browser = load('docs/action-sound-main-browser.json')
    assert browser['console'] == [] and len(browser['rows']) == 6
    rows = {r['name']: r for r in browser['rows']}
    for row in rows.values():
        for p, digest in row['sources'].items():
            assert sha(ROOT / p) == digest, p
        assert row['paused'] and row['glError'] == 0
        assert all(s['context'] == 'running' and s['after'] == s['before'] + 1 for s in row['sounds'])
    for material, item, gain in [('tree', 'wood', 3), ('stone', 'stone', 3), ('fiber', 'fiber', 2)]:
        row = rows[material + '-main']
        assert row['inventory'][item] == gain and len(row['events']) == 1
        assert [(s['kind'], s['options']) for s in row['sounds']] == [('gather', {'surface': material})]
        assert row['events'][0]['time'] == row['sounds'][0]['time']
    crab = rows['crab-sword-main']
    assert crab['targetHp'] == 2 and crab['hp'] == 100
    assert [(s['kind'], s['options']) for s in crab['sounds']] == [('swing', {'weapon': 'sword'}), ('hit', {'enemyType': 'crab'})]
    assert crab['sounds'][0]['time'] < crab['sounds'][1]['time'] == crab['events'][0]['time']
    miss = rows['axe-miss-main']
    assert miss['events'] == [] and [s['kind'] for s in miss['sounds']] == ['swing']
    hurt = rows['hurt-mobile-main']
    assert hurt['hp'] == 88 and hurt['targetHp'] == 40 and hurt['viewport'] == [390, 844]
    assert hurt['events'] == [] and [s['kind'] for s in hurt['sounds']] == ['hurt']
    pcm = load('docs/action-sound-pcm-browser.json')
    assert pcm['complete'] and pcm['console'] == [] and len(pcm['reports']) == 2
    for report in pcm['reports']:
        assert report['sourceSha256'] == sha(ROOT / 'src/audio.js')
        assert 0 < report['peak'] < 1 and report['disposed'] and report['remainingBeforeDispose'] == 0
        with wave.open(str(ROOT / ('docs/action-sound-' + report['mode'] + '.wav')), 'rb') as f:
            assert f.getframerate() == 48000 and f.getnchannels() == 1 and f.getsampwidth() == 2
            assert f.getnframes() == report['seconds'] * 48000
            data = array.array('h', f.readframes(f.getnframes()))
            if sys.byteorder != 'little':
                data.byteswap()
            assert abs(max(abs(v) for v in data) / 32767 - report['peak']) < 1 / 32767
    isolated, mix = pcm['reports']
    assert len(isolated['windows']) == 13 and len(mix['windows']) == 11
    windows = isolated['windows']
    assert windows[1]['crossings'] > windows[0]['crossings'] * 2
    assert windows[7]['crossings'] > windows[6]['crossings'] > windows[5]['crossings']
    assert windows[9]['crossings'] > windows[8]['crossings'] > windows[10]['crossings']
    assert windows[3]['rms'] < windows[0]['rms']
    assert mix['events'][8]['kind'] == 'pause' and mix['events'][8]['after'] == 0
    assert mix['events'][9]['kind'] == 'food' and mix['events'][9]['after'] == 1
    assert mix['events'][10]['kind'] == 'mute' and mix['events'][10]['after'] == 0
    assert mix['windows'][-1]['peak'] == mix['windows'][-1]['rms'] == 0
    ordinary = load('docs/action-sound-package-browser.json')
    assert ordinary['console'] == [] and 'progress indicator Value: 79, ID: hp' in ordinary['ax']
    assert '位置 X 7.2，Z 53.5；建筑 1；击败 3' in ordinary['ax'] and '群岛，再次相连' in ordinary['ax']
    for item, count in [('木材', 4), ('石料', 5), ('纤维', 6), ('浆果', 3), ('贝壳', 0), ('晶石', 0), ('石斧', 1), ('晶石剑', 0), ('烤浆果', 0)]:
        assert re.search(r'text ' + item + r'\n\s+\d+ text ' + str(count) + r'\n', ordinary['bagAx'])
    assert sha(ROOT / 'docs/beacon-footing-normal-save.json') == '33455473ff0e92097db6351e2ea421e498accde405ee5a9482ae8ef16d55bb29'
    for label, count in [('focused', 26), ('full-tests', 307)]:
        log = (ROOT / ('docs/action-sound-' + label + '.txt')).read_text()
        assert '# tests ' + str(count) + '\n' in log and '# fail 0\n' in log
    assert '# fail 3\n' in (ROOT / 'docs/action-sound-red.txt').read_text()
    images = sorted((ROOT / 'docs').glob('action-sound-*.jpg'))
    assert len(images) == 4 and all(p.read_bytes()[:2] == b'\xff\xd8' for p in images)
    files = [*sorted((ROOT / 'docs').glob('action-sound-*')), *sorted((ROOT / 'tests').glob('action-sound*')),
             ROOT / 'tools/verify_action_sound.py', ROOT / 'docs/ACTION-SOUND-DELIVERY.md',
             ROOT / ('docs/' + NAME + '-verification.json')]
    files = [p for p in files if p.name != 'action-sound-audit.json']
    report = dict(verified=True, boundedActionSoundDelivered=True, archive=package['archive'], archiveSha256=package['archiveSha256'],
                  archiveBytes=package['archiveBytes'], runtimeInputs=94, changedInputs=changed, extractedPath=unpack['extractedPath'],
                  focusedTests=26, fullTests=307, nativeFixtures=6, imagesViewed=4, pcmSeconds=26,
                  pcmPeaks={r['mode']: r['peak'] for r in pcm['reports']}, audibleQualityAccepted=False,
                  ordinaryDesktopRestored=True, ordinary390ReloadRestored=False, ordinaryNewJsonExported=False,
                  graphicsRuntimeSourcesUnchanged=True, currentExactSourceGpuAccepted=False, currentExactSourceEnduranceAccepted=False,
                  fullGoalComplete=False, milestoneM5Complete=False,
                  scope='Production cue identity/result scheduling and native offline PCM, not audition or final mixing. Six isolated native-input fixtures, not an uninterrupted ordinary journey. Current desktop restore only. Original graphical GPU samples stay at their captured SHA.',
                  files={str(p.relative_to(ROOT)): sha(p) for p in files})
    (ROOT / 'docs/action-sound-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({k: report[k] for k in ['verified', 'boundedActionSoundDelivered', 'archiveSha256', 'fullGoalComplete']}))


if __name__ == '__main__':
    verify()
