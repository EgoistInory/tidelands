"""Audit authored-rig inertia reconnection; never assert final animation quality."""
import hashlib
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sha = lambda p: hashlib.sha256((ROOT / p).read_bytes()).hexdigest()
load = lambda p: json.loads((ROOT / p).read_text())


def verify():
    before = load('docs/authored-motion-before.json')
    rows = load('docs/authored-motion-browser.json')
    by_name = {r['label']: r for r in rows}
    assert before['frames'] == 360 and before['bodyMotionMax'] == {'bank': 0, 'drive': 0}
    after = by_name['coast']
    for key in ('start', 'position', 'distance', 'time', 'hp', 'inventory'):
        assert before[key] == after[key], key
    assert len(rows) == 7
    for row in rows:
        assert not row['running'] and not row['hidden'] and row['glError'] == 0
        assert row['authored'] and all(role[1] for role in row['roles'])
        assert row['maxSoleError'] < .003 and row['hp'] == 100
    for name in ('coast', 'forest', 'mobile-forest'):
        row = by_name[name]
        assert row['frames'] == 360 and row['raf']['samples'] == 359
        assert .01 < row['bodyMotionMax']['bank'] < .13
        assert .01 < row['bodyMotionMax']['drive'] < 1
    assert by_name['mobile-forest']['viewport'] == [390, 844]
    # Segmented inspection deliberately contains operator wait time: no frame-budget claim.
    assert [by_name[n]['frames'] for n in ('forest-start90', 'forest-turn180', 'forest-stop270', 'forest-settled360')] == [90, 180, 270, 360]
    cpu = load('docs/authored-motion-world-cpu.json')
    assert len(cpu['rows']) == 36 and sum(r['frames'] for r in cpu['rows']) == 8424
    assert all(r['maxError'] < .03 and r['respawns'] == 0 for r in cpu['rows'])
    for path, digest in cpu['files'].items():
        assert sha(path) == digest, path
    markers = load('assets/characters/action-landmarks.json')
    assert markers['toolCalibration']['sourceSha256'] == sha('src/authored-character.js')
    old = json.loads(subprocess.check_output(['git', 'show', 'feb46d3:assets/characters/action-landmarks.json'], cwd=ROOT))
    assert markers['rows'] == old['rows'] and markers['toolCalibration']['rows'] == old['toolCalibration']['rows']
    for file, count in [('authored-motion-focused.txt', 15), ('authored-motion-full-tests.txt', 277)]:
        text = (ROOT / 'docs' / file).read_text()
        assert f'# tests {count}\n' in text and f'# pass {count}\n' in text and '# fail 0\n' in text
    red = (ROOT / 'docs/authored-motion-red.txt').read_text()
    assert '# fail 1\n' in red and 'traveler actual moving turn bank 0' in red
    assert sha('dist/tidelands-m5-2026-10-23-rhythm-center.zip') == '8bc83a22213e541bf876e164ed622f44f34fcd6ab1976eaad4c388562d24eabc'
    assert sha('docs/beacon-footing-normal-save.json') == '33455473ff0e92097db6351e2ea421e498accde405ee5a9482ae8ef16d55bb29'
    images = ['docs/authored-motion-before.jpg'] + ['docs/authored-motion-' + r['label'] + '.jpg' for r in rows]
    for path in images:
        assert (ROOT / path).read_bytes()[:2] == b'\xff\xd8', path
    files = list(cpu['files']) + images + ['assets/characters/action-landmarks.json', 'tests/authored-world-actor.test.js', 'tests/authored-motion-review.html', 'docs/authored-motion-browser.json', 'docs/authored-motion-before.json', 'docs/authored-motion-world-cpu.json', 'docs/authored-motion-focused.txt', 'docs/authored-motion-full-tests.txt', 'docs/authored-motion-red.txt']
    report = {'verified': True, 'scope': 'Bounded actual authored-rig acceleration/braking/turn response. Bone anchors are not skinned boot contact or animation naturalness. No current GPU/endurance, action/combat reacceptance, new package, ordinary save change, human audition, device or M5/3A completion.', 'sourceBaseline': 'feb46d3', 'console': [], 'candidateDelivered': False, 'fullGoalComplete': False, 'maxSoleError': max(r['maxError'] for r in cpu['rows']), 'rejectedCaptures': 'Three incomplete canvas.toDataURL captures retained in ignored dist/rejected-authored-motion-canvas; excluded from accepted images. Native screenshots used instead.', 'segmentedRafRejected': True, 'files': {p: sha(p) for p in files}}
    (ROOT / 'docs/authored-motion-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    return report


if __name__ == '__main__':
    print(json.dumps(verify(), ensure_ascii=False, indent=2))
