"""Verify bounded QA artifacts, including rejected visuals; no full-quality claim."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKUP_SHA = '33455473ff0e92097db6351e2ea421e498accde405ee5a9482ae8ef16d55bb29'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read(path):
    return json.loads((ROOT / path).read_text())


def verify_rows(report, directory, count):
    assert report['complete'] and report['logs'] == []
    assert len(report['rows']) == count
    for row in report['rows']:
        assert row['glError'] == 0
        assert sha(ROOT / directory / row['image']) == row['sha256']


def verify():
    composition = read('docs/highland-composition-observations.json')
    verify_rows(composition, 'dist/highland-composition-2026-11-03', 11)
    for path, digest in composition['sources'].items():
        assert sha(ROOT / path) == digest, path
    for row in composition['rows']:
        assert row['worldUnchanged'] and row['stateUnchanged']
        assert row['composition'] == {'minerals': 22, 'ferns': 51, 'batches': 10}
        if row['variant'] == 'composed':
            old = next(r for r in composition['rows'] if r['variant'] == 'old'
                       and r['kind'] == row['kind'] and r['distance'] == row['distance'])
            for key in ['camera', 'lookAt', 'buffer']:
                assert row[key] == old[key], key
    visual = read('docs/highland-composition-audit.json')
    assert visual['decision'] == 'reject-current-composition'
    assert not visual['productionIntegrated'] and not visual['milestoneM5Complete']
    assert sha(ROOT / 'docs/beacon-footing-normal-save.json') == BACKUP_SHA
    before = read('docs/beacon-footing-normal-save.json')
    summaries = []
    for name, directory in [('coastal', 'r2-continuous-2026-11-03'),
                            ('encounter', 'r2-encounter-2026-11-03')]:
        filename = 'r2-continuous-coastal' if name == 'coastal' else 'r2-native-encounter'
        report = read('docs/' + filename + '-observations.json')
        verify_rows(report, 'dist/' + directory, 9)
        assert report['backupSha256'] == BACKUP_SHA and report['reloadExact']
        assert report['entry'].endswith('/dist/tidelands-m5-2026-11-02-regional-landforms-r2/tidelands-local/')
        assert all(not row['hidden'] for row in report['rows'])
        assert sha(ROOT / 'dist' / directory / report['video']) == report['videoSha256']
        saved = report['saved']
        assert saved['quest'] == before['quest'] and saved['buildings'] == before['buildings']
        assert saved['time'] > before['time'] and saved['respawn'] == before['respawn']
        assert saved['protectedUntil'] == before['protectedUntil']
        assert [e['id'] for e in saved['enemies']] == [e['id'] for e in before['enemies']]
        feedback = [row['text'] for row in report['feedback']]
        if name == 'coastal':
            assert saved['inventory'] == before['inventory']
            assert saved['kills'] == before['kills'] == 3 and saved['player']['hp'] == 79
            assert feedback.count('未命中 · 面向目标并靠近再攻击') == 80
        else:
            assert sha(ROOT / 'tools/run_r2_continuous_journey.mjs') == report['runnerSha256']
            assert saved['kills'] == before['kills'] + 1 == 4
            assert saved['player']['hp'] == 48
            assert next(e['hp'] for e in saved['enemies'] if e['id'] == 'enemy-52') == -6
            expected_inventory = dict(before['inventory'], fiber=8)
            assert saved['inventory'] == expected_inventory
            assert '命中 1 个目标' in feedback and '击败 1 个目标' in feedback
            assert feedback.count('受到伤害 −7') == 7
            rows = {row['phase']: row for row in report['rows']}
            assert rows['after-combat']['hp'] == 37 and rows['after-food']['hp'] == 55
        summaries.append({'name': name, 'activeWallMs': report['activeWallMs'],
                          'gameSeconds': saved['time'] - before['time'],
                          'killsBefore': before['kills'], 'killsAfter': saved['kills'],
                          'hpAfter': saved['player']['hp'], 'reloadExact': True,
                          'imagesReviewed': 9, 'video': 'dist/' + directory + '/' + report['video'],
                          'videoSha256': report['videoSha256']})
    result = {'artifactsVerified': True, 'compositionRejected': True,
              'nativeShortEncounterVerified': True, 'journeys': summaries,
              'fullVideosWatched': False, 'animationNaturalnessAccepted': False,
              'audioQualityAccepted': False, 'milestoneM5Complete': False,
              'fullGoalComplete': False}
    (ROOT / 'docs/r2-native-journey-audit.json').write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result))


if __name__ == '__main__':
    verify()
