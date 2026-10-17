"""Materialize the verified local ecosystem package for same-canvas QA only."""
import hashlib
import json
import subprocess
from pathlib import Path
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]


def prepare():
    manifest = json.loads((ROOT / 'dist/tidelands-m5-2026-10-16-ecosystem.json').read_text())
    archive = ROOT / 'dist' / manifest['archive']
    assert hashlib.sha256(archive.read_bytes()).hexdigest() == manifest['archiveSha256']
    dest = ROOT / 'dist/frame-budget-baseline'
    with ZipFile(archive) as zipped:
        for name, entry in manifest['files'].items():
            assert not Path(name).is_absolute() and '..' not in Path(name).parts
            data = zipped.read('tidelands-local/' + name)
            assert hashlib.sha256(data).hexdigest() == entry['sha256']
            target = dest / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
    harness = (ROOT / 'tests/frame-budget-review.html').read_bytes()
    (dest / 'tests').mkdir(exist_ok=True)
    (dest / 'tests/frame-budget-review.html').write_bytes(harness)
    before = ROOT / 'dist/frame-budget-before'
    with ZipFile(archive) as zipped:
        for name in manifest['files']:
            target = before / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(zipped.read('tidelands-local/' + name))
    candidate = json.loads((ROOT / 'docs/creature-grounding-candidate.json').read_text())
    for name, digest in candidate['changedRuntime'].items():
        data = subprocess.check_output(['git', 'show', 'cf786cacc751c612e62d74d4ac5f4de840b1407f:' + name], cwd=ROOT)
        assert hashlib.sha256(data).hexdigest() == digest
        (before / name).write_bytes(data)
    (before / 'tests').mkdir(exist_ok=True)
    (before / 'tests/frame-budget-review.html').write_bytes(harness)
    proof = {'archiveSha256': manifest['archiveSha256'], 'baselineFilesMatched': len(manifest['files']),
             'harnessSha256': hashlib.sha256(harness).hexdigest(), 'baselineDirectory': str(dest),
             'beforeDirectory': str(before), 'beforeChangedRuntime': candidate['changedRuntime'],
             'scope': 'Verified51 runtime inputs, same current diagnostic harness; no production or save writes.'}
    (ROOT / 'docs/frame-budget-baseline-prepared.json').write_text(json.dumps(proof, indent=2) + '\n')
    print(json.dumps(proof))


if __name__ == '__main__':
    prepare()
