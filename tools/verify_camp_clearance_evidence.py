"""Replay saved camp clearance evidence and the corrected QA isolation audit."""
import hashlib
import json
from pathlib import Path
import re
import zipfile

ROOT = Path(__file__).resolve().parents[1]
NAME = 'tidelands-m5-2026-10-12-campclear'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read(name):
    return json.loads((ROOT / 'docs' / name).read_text())


def audit():
    review = read('camp-clearance-review.json')
    for name, expected in review['validationSourceSha256'].items():
        assert sha(ROOT / name) == expected, name
    build = json.loads((ROOT / 'dist' / (NAME + '.json')).read_text())
    prior = json.loads((ROOT / 'dist' / 'tidelands-m5-2026-10-12-textile.json').read_text())
    changed = {n for n in prior['files'] if n.startswith('src/') and sha(ROOT / n) != prior['files'][n]['sha256']}
    assert changed == {'src/meadow.js', 'src/scene.js'} and len(build['files']) == 42
    assert sha(ROOT / 'dist' / build['archive']) == build['archiveSha256']
    with zipfile.ZipFile(ROOT / 'dist' / build['archive']) as archive:
        assert len(archive.namelist()) == 43 and archive.testzip() is None
        for name, entry in build['files'].items():
            assert hashlib.sha256(archive.read('tidelands-local/' + name)).hexdigest() == entry['sha256']
            assert sha(ROOT / ('docs/LOCAL-DELIVERY.md' if name == 'README.md' else name)) == entry['sha256'], name
    assert len(review['historicalArchives']) == 27
    for name, expected in review['historicalArchives'].items():
        assert sha(ROOT / 'dist' / name) == expected, name
    log = (ROOT / 'docs/camp-clearance-final-full-tests.txt').read_text()
    assert re.search(r'^# pass 173$', log, re.M) and re.search(r'^# fail 0$', log, re.M)
    assert "does not provide an export named 'updateCampClearance'" in (ROOT / 'docs/camp-clearance-red-tests.txt').read_text()
    assert '1 !== 0' in (ROOT / 'docs/camp-clearance-buffer-red-tests.txt').read_text()
    numerical = read('camp-clearance-numerical.json')
    assert numerical['passed'] and numerical['exactMatricesRestored'] and numerical['unchangedBuffersSkipUploads']
    assert numerical['instances'] == 115135 and numerical['tail500Hidden'] == 139
    assert [t['hidden'] for t in numerical['timings']] == [139, 93, 92]
    for name, expected in numerical['sourceSha256'].items():
        assert sha(ROOT / name) == expected, name
    ui = read('camp-clearance-ui.json')
    assert len(ui['samples']) == 9 and not ui['console'] and all(s['ready'] and s['glError'] == 0 for s in ui['samples'])
    assert ui['samples'][0]['hiddenInstances'] == 139 and ui['samples'][1]['hiddenInstances'] == ui['samples'][2]['hiddenInstances'] == 0
    assert ui['samples'][-1]['viewport'] == ui['samples'][-2]['viewport'] == [390, 844]
    motions = []
    for name in ('camp-clearance-desktop-motion.json', 'camp-clearance-mobile-motion.json'):
        evidence = read(name)
        stats = evidence['stats']
        assert stats['complete'] and stats['elapsedMs'] >= 10000 and len(stats['frames']) > 500 and not stats['hidden']
        assert evidence['glError'] == 0 and all(f['hidden'] == 139 for f in stats['frames'])
        motions.append({'viewport': evidence['viewport'], 'frames': len(stats['frames']), **{k: stats[k] for k in ('p95Ms', 'maxMs', 'over50ms')}})
    created, restored = read('camp-clearance-build-created.json')['state'], read('camp-clearance-build-restored.json')
    assert created == restored['state'] and created['viewCount'] == 1 and created['hiddenInstances'] == 59 and created['glError'] == 0
    assert created['inventory']['wood'] == 32 and created['inventory']['fiber'] == 10 and len(created['buildings']) == 1
    assert created['buildings'][0]['type'] == 'tent' and not restored['console']
    before, after = read('harness-formal-save-before.json'), read('harness-formal-save-after.json')
    assert before == after and before['readOnly'] and before['valid']
    early = read('harness-early-resume-revalidated.json')
    assert early['label'] == '继续旅程' and not early['console']
    a, b = early['original'], early['actualAfterContinue']
    assert a['viewCount'] == b['viewCount'] == 1 and a['time'] <= b['time'] < 121
    assert a['quest'] == b['quest'] == 0 and a['position'] == b['position'] and a['inventory'] == b['inventory']
    correction = read('harness-isolation-correction.json')
    assert not correction['revalidationPending'] and correction['revalidation']['historyBeforeReadOnlySnapshotStillUncertain']
    package = read('camp-clearance-package-ui.json')
    assert not package['fixtureImported'] and not package['stateInjected'] and not package['console']
    final = package['restored']
    assert final['coordinates'] == '位置 X -73.0，Z 93.5；建筑 0；击败 0' and final['hp'] == '100'
    assert final['width'] == final['scrollWidth'] == 390
    assert {i['name']: int(i['count']) for i in final['inventory']}['木材'] == 2
    for name, expected in review['imagesViewedSha256'].items():
        assert sha(ROOT / name) == expected, name
    report = {'kind': 'bounded-camp-clearance-and-isolation-evidence-audit', 'passed': True,
              'fullGoalComplete': False, 'milestoneM5Complete': False, 'pendingBatchEvidence': [],
              'changedProduction': sorted(changed), 'archive': {k: build[k] for k in ('archive', 'archiveBytes', 'archiveEntries', 'archiveSha256')},
              'runtimeSha256': {n: sha(ROOT / n) for n in build['files'] if n.startswith('src/')},
              'historicalArchivesPreserved': 27, 'motions': motions, 'actualBuild': created, 'ordinaryFinal': final,
              'correctedTestsFormalSaveUnchanged': before['sha256'], 'priorIsolationDiagnosticWithdrawn': correction['oldEarlyResumeDiagnosticWithdrawn'],
              'limits': review['remainingQuality'],
              'evidenceSha256': {str(p.relative_to(ROOT)): sha(p) for pattern in ('camp-clearance-*', 'harness-*') for p in sorted((ROOT / 'docs').glob(pattern)) if p.name not in ('camp-clearance-review.json', 'camp-clearance-final-audit.json')}}
    (ROOT / 'docs/camp-clearance-final-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({k: report[k] for k in ('passed', 'fullGoalComplete', 'historicalArchivesPreserved', 'motions')}, ensure_ascii=False))
    return report


if __name__ == '__main__':
    audit()
