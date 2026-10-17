"""Audit the bounded night bounce palette; no complete readability claim."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def sha(name):
    return hashlib.sha256((ROOT / name).read_bytes()).hexdigest()


def verify():
    a = json.loads((ROOT / 'docs/night-subject-before.json').read_text())
    b = json.loads((ROOT / 'docs/night-subject-after.json').read_text())
    assert len(a['rows']) == 5 and len(b['rows']) == 6 and not a['console'] and not b['console']
    for old, new in zip(a['rows'], b['rows']):
        assert old['site'] == new['site'] and old['time'] == new['time'] and old['player'] == new['player']
        assert old['glError'] == new['glError'] == 0
        for field in ['ambientIntensity', 'nightSideIntensity', 'sunIntensity']:
            assert old[field] == new[field]
        if new['time'] == 240:
            assert old['ambientSky'] == new['ambientSky'] and old['ambientGround'] == new['ambientGround']
        else:
            assert new['ambientSky'][2] > new['ambientSky'][1] and new['ambientGround'][2] > new['ambientGround'][1]
    assert b['rows'][-1]['viewport'] == [390, 844] and b['rows'][-1]['glError'] == 0
    for label, count in [('tests', 234), ('focused', 9)]:
        text = (ROOT / f'docs/night-palette-{label}.txt').read_text()
        assert f'# tests {count}\n' in text and f'# pass {count}\n' in text and '# fail 0\n' in text
    assert '# fail 1\n' in (ROOT / 'docs/night-palette-red.txt').read_text()
    package_name = 'tidelands-m5-2026-10-17-grounding-budget-night'
    package = json.loads((ROOT / f'dist/{package_name}.json').read_text())
    archive_check = json.loads((ROOT / f'docs/{package_name}-verification.json').read_text())
    assert archive_check['passed'] and archive_check['checkedFiles'] == 51
    assert sha('dist/' + package['archive']) == archive_check['archiveSha256'] == package['archiveSha256']
    for name, entry in package['files'].items():
        assert sha('docs/LOCAL-DELIVERY.md' if name == 'README.md' else name) == entry['sha256']
        assert hashlib.sha256((Path(archive_check['extractedPath']) / name).read_bytes()).hexdigest() == entry['sha256']
    files = ['docs/night-subject-before.json', 'docs/night-subject-after.json', 'tests/night-subject-review.html', 'docs/night-palette-tests.txt', 'docs/night-palette-focused.txt', 'docs/night-palette-red.txt']
    images = [f'docs/night-subject-{mode}-{site}-{time}.png' for mode in ['before', 'after'] for site, time in [('coast', 0), ('forest', 0), ('highland', 1440), ('camp', 0), ('coast', 240)]] + ['docs/night-subject-after-mobile.png']
    report = {'boundedPaletteVerified': True, 'nightReadabilityFullyAccepted': False,
              'delivered': False, 'fullGoalComplete': False, 'milestoneM5Complete': False,
              'sourceSha256': {p: sha(p) for p in ['src/scene.js', 'src/creature.js']},
              'fullTests': 234, 'focusedTests': 9, 'beforeRows': 5, 'afterRows': 6,
              'preparedArchive': package['archive'], 'preparedArchiveSha256': package['archiveSha256'],
              'archiveVerifiedFiles': 51, 'extractedPath': archive_check['extractedPath'], 'browserLaunchVerified': False,
              'evidenceSha256': {p: sha(p) for p in files + images},
              'scope': 'Frozen declared player/three NPC/two enemy/camp positions.11 images reviewed; sky/ground bounce hue becomes cool at night, light intensities and noon colors unchanged. No new light/material/shadow pass. Remaining dark faces, model style and posture/contact gaps persist. Not movement/native campaign/GPU/endurance/listening/phone proof. Prior be4848c GPU/load source remains historical after this scene change.'}
    (ROOT / 'docs/night-palette-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({k: v for k, v in report.items() if k != 'evidenceSha256'}, ensure_ascii=False))


if __name__ == '__main__':
    verify()
