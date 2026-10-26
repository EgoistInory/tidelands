"""Copy only audited low woodland assets; never overwrite different runtime files."""
from pathlib import Path
import hashlib
import json

ROOT = Path(__file__).resolve().parents[1]


def promote():
    source = ROOT / 'dist/forest-collection-candidate'
    audit = json.loads((ROOT / 'docs/forest-collection-audit.json').read_text())['candidateFiles']
    output = ROOT / 'assets/woodland'
    files = {}
    for name in ['fern_02', 'rock_moss_set_01']:
        for path in (source / name).rglob('*'):
            if not path.is_file():
                continue
            data = path.read_bytes()
            assert hashlib.sha256(data).hexdigest() == audit[str(path.relative_to(ROOT))]['sha256']
            relative = path.relative_to(source)
            target = output / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            if target.exists() and target.read_bytes() != data:
                raise FileExistsError('Refuse different runtime asset')
            target.write_bytes(data)
            files[str(relative)] = {'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
    license_data = b'Woodland models and source textures by Poly Haven contributors. CC0-1.0.\nhttps://polyhaven.com/license\nhttps://polyhaven.com/a/fern_02\nhttps://polyhaven.com/a/rock_moss_set_01\nModified: bounded rock geometry simplification and maximum 512px textures.\n'
    target = output / 'LICENSE.txt'
    if target.exists() and target.read_bytes() != license_data:
        raise FileExistsError('Refuse different license notice')
    target.write_bytes(license_data)
    files['LICENSE.txt'] = {'bytes': len(license_data), 'sha256': hashlib.sha256(license_data).hexdigest()}
    manifest = {'license': 'CC0-1.0', 'sourceReview': 'docs/FOREST-COLLECTION-CHECKPOINT.md',
                'collectionPage': 'https://polyhaven.com/collections/pine_forest', 'files': files}
    data = (json.dumps(manifest, indent=2) + '\n').encode()
    target = output / 'provenance.json'
    if target.exists() and target.read_bytes() != data:
        raise FileExistsError('Refuse different provenance')
    target.write_bytes(data)
    print(json.dumps({'files': len(files) + 1, 'bytes': sum(v['bytes'] for v in files.values()) + len(data)}))


if __name__ == '__main__':
    promote()
