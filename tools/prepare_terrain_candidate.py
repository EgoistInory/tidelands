"""Create a local, reproducible runtime snapshot for a broad terrain composition experiment."""
from pathlib import Path
import hashlib
import json
import zipfile

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'dist/terrain-composition-candidate/tidelands-local'


def prepare():
    package = json.loads((ROOT / 'dist/tidelands-m5-2026-10-24-hud-field.json').read_text())
    archive = ROOT / 'dist' / package['archive']
    assert hashlib.sha256(archive.read_bytes()).hexdigest() == package['archiveSha256']
    assert not DEST.exists(), 'Preserve existing candidate snapshot; choose a new explicit destination before rebuilding.'
    with zipfile.ZipFile(archive) as source:
        for n, row in package['files'].items():
            data = source.read('tidelands-local/' + n)
            assert hashlib.sha256(data).hexdigest() == row['sha256']
            target = DEST / n
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
    world = DEST / 'src/world.js'
    before = world.read_text()
    assert before.count('export function terrain(x,z){') == 1
    after = "import {landformOffset} from './terrain-composition-candidate.js';\n" + before.replace('export function terrain(x,z){', 'function previousTerrain(x,z){')
    after += '\nconst protectedCompositionSites=[SPAWN,...LANDMARKS];\nexport function terrain(x,z){const base=previousTerrain(x,z);return base+landformOffset(x,z,base,ISLANDS,protectedCompositionSites);}\n'
    world.write_text(after)
    (DEST / 'src/terrain-composition-candidate.js').write_bytes((ROOT / 'tests/terrain-composition-candidate.js').read_bytes())
    (DEST / 'tests').mkdir()
    (DEST / 'tests/terrain-composition-review.html').write_bytes((ROOT / 'tests/terrain-composition-review.html').read_bytes())
    result = dict(kind='isolated-runtime-snapshot', path=str(DEST), baseArchiveSha256=package['archiveSha256'],
                  candidateWorldSha256=hashlib.sha256(world.read_bytes()).hexdigest(),
                  candidateHelperSha256=hashlib.sha256((DEST / 'src/terrain-composition-candidate.js').read_bytes()).hexdigest(),
                  productionChanged=False, ordinarySaveReadOrWritten=False, fullGoalComplete=False)
    (ROOT / 'docs/terrain-composition-source.json').write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result))


if __name__ == '__main__':
    prepare()
