"""Copy the verified local delivery into an isolated missing-geometry fixture."""
from pathlib import Path
import hashlib
import json

ROOT = Path(__file__).resolve().parents[1]
NAME = 'tidelands-m5-2026-10-26-regional-woodland'


def prepare():
    report = json.loads((ROOT / f'docs/{NAME}-verification.json').read_text())
    manifest = json.loads((ROOT / f'dist/{NAME}.json').read_text())
    source = Path(report['extractedPath'])
    target = ROOT / 'dist/woodland-missing-geometry/tidelands-local'
    omitted = []
    for name, row in manifest['files'].items():
        data = (source / name).read_bytes()
        assert hashlib.sha256(data).hexdigest() == row['sha256'], name
        if name.startswith('assets/woodland/') and name.endswith(('.gltf', '.bin')):
            omitted.append(name)
            continue
        path = target / name
        path.parent.mkdir(parents=True, exist_ok=True)
        if path.exists():
            assert path.read_bytes() == data, 'Do not overwrite an existing fixture'
        else:
            path.write_bytes(data)
    entry = (source / 'index.html').read_text().replace('<body>', '<body data-test-harness="true">').replace(
        '<script type="module" src="src/main.js"></script>',
        '<script type="module">import {boot} from "./src/main.js";boot({storageKey:"tidelands-woodland-missing-geometry"});</script>')
    entry_path = target / 'failure-entry.html'
    if entry_path.exists():
        assert entry_path.read_text() == entry
    else:
        entry_path.write_text(entry)
    result = dict(fixture=str(target), omitted=omitted, productionFilesModified=False,
                  extraEntry='failure-entry.html', isolatedStorageKey='tidelands-woodland-missing-geometry',
                  scope='Same delivery runtime except missing optional woodland geometry; extra entry uses an isolated save key')
    (ROOT / 'docs/woodland-missing-geometry-fixture.json').write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result))


if __name__ == '__main__':
    prepare()
