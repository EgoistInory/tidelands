"""Verify the bounded whole-body candidate without broad visual-quality claims."""
import hashlib
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def load(path):
    return json.loads((ROOT / path).read_text())


def sha(path):
    return hashlib.sha256((ROOT / path).read_bytes()).hexdigest()


def verify():
    report = load('docs/body-motion-source-checkpoint.json')
    changes = set()
    for path, digest in report['sources'].items():
        assert sha(path) == digest, path
        if path == 'src/body-motion.js':
            changes.add(path)
            continue
        old = subprocess.check_output(['git', 'show', '27bfe0e:' + path], cwd=ROOT)
        if hashlib.sha256(old).hexdigest() != digest:
            changes.add(path)
    assert changes == {'src/body-motion.js', 'src/character.js', 'src/creature.js'}
    world = load('docs/body-motion-world-browser.json')
    creatures = load('docs/body-motion-creatures-browser.json')
    assert not world['console'] and not creatures['console']
    assert len(world['rows']) == len(creatures['rows']) == 2
    assert {tuple(row['viewport']) for row in world['rows']} == {(1440, 900), (390, 844)}
    for row in world['rows']:
        assert row['frames'] == 180 and row['raf']['samples'] == 179
        assert row['distance'] > 20 and .01 < row['bodyMotionMax']['bank'] < .13
        assert .01 < row['bodyMotionMax']['drive'] <= 1
        assert len(row['poses']) == 6
        assert row['hp'] == 100 and not row['running'] and not row['hidden'] and row['glError'] == 0
    assert {row['type'] for row in creatures['rows']} == {'boar', 'crab'}
    for row in creatures['rows']:
        assert row['frames'] == 360 and row['raf']['samples'] == 359
        assert row['plantedSamples'] > 500 and row['swingSamples'] > 80
        assert row['maxGap'] < .015 and row['maxSlide'] < .015 and row['maxMeshGap'] < .02
        assert .005 < row['maxBank'] < .1
        assert not row['running'] and not row['hidden'] and row['glError'] == 0
    for file, count in [('body-motion-focused-tests.txt', 39), ('body-motion-full-tests.txt', 252)]:
        text = (ROOT / 'docs' / file).read_text()
        assert f'# tests {count}\n' in text and f'# pass {count}\n' in text and '# fail 0\n' in text
    assert sha('dist/tidelands-m5-2026-10-18-beacon-footing.zip') == '2d922da8581be03234e0b721cf7f5561b8d0612a5093ac55f82b5330b33ae5ca'
    assert sha('docs/beacon-footing-normal-save.json') == '33455473ff0e92097db6351e2ea421e498accde405ee5a9482ae8ef16d55bb29'
    files = ['docs/body-motion-world-browser.json', 'docs/body-motion-creatures-browser.json',
             'docs/body-motion-world-desktop.jpg', 'docs/body-motion-world-mobile.jpg', 'docs/body-motion-boar.jpg', 'docs/body-motion-crab.jpg',
             'docs/body-motion-focused-tests.txt', 'docs/body-motion-full-tests.txt', 'docs/body-motion-red-tests.txt',
             'tests/body-motion.test.js', 'tests/whole-world-art-review.html', 'tests/creature-footing-review.html']
    for file in files:
        if file.endswith('.jpg'):
            assert (ROOT / file).read_bytes()[:2] == b'\xff\xd8'
    report.update(verified=True, boundedBodyMotionAccepted=True, candidateDelivered=False,
                  fullM5Complete=False, fullGoalComplete=False, naturalFullBodyQualityAccepted=False,
                  evidenceSha256={file: sha(file) for file in files}, browserFrames=1080,
                  note='Shared kinematic torso drive/turn response, existing ground-contact invariants and four browser fixtures. Creature script crosses a tree; NPC samples remain at rest. Not obstacle-aware scripted travel, physical gait, new models, complete natural movement, GPU/endurance, phone hardware or new package acceptance.')
    (ROOT / 'docs/body-motion-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print('bounded torso drive/turn and preserved contacts verified; natural/full M5/3A remain false')


if __name__ == '__main__':
    verify()
