"""Make bounded 512px local textures for the isolated forest collection."""
from pathlib import Path
import hashlib
import io
import json
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'dist/forest-collection-source'
OUT = ROOT / 'dist/forest-collection-candidate'


def prepare():
    original = json.loads((SOURCE / 'manifest.json').read_text())
    report = {'license': original['license'], 'licensePage': original['licensePage'],
              'collectionPage': original['collectionPage'], 'files': {}, 'productionIntegrated': False}
    for name in original['models']:
        doc = json.loads((OUT / name / f'{name}.gltf').read_text())
        for image in doc['images']:
            key = name + '/' + image['uri']
            data = (SOURCE / key).read_bytes()
            assert hashlib.sha256(data).hexdigest() == original['files'][key]['sha256']
            with Image.open(io.BytesIO(data)) as bitmap:
                source_size = list(bitmap.size)
                bitmap.thumbnail((512, 512), Image.Resampling.LANCZOS)
                stream = io.BytesIO()
                bitmap.save(stream, format='PNG' if image['uri'].endswith('.png') else 'JPEG', **({} if image['uri'].endswith('.png') else {'quality': 90}))
                result = stream.getvalue()
                path = OUT / key
                path.parent.mkdir(parents=True, exist_ok=True)
                if path.exists() and path.read_bytes() != result:
                    raise FileExistsError('Refuse changed existing texture')
                path.write_bytes(result)
                report['files'][key] = {'sourceSize': source_size, 'candidateSize': list(bitmap.size),
                                       'bytes': len(result), 'sha256': hashlib.sha256(result).hexdigest()}
    report['textureBytes'] = sum(f['bytes'] for f in report['files'].values())
    (OUT / 'texture-manifest.json').write_text(json.dumps(report, indent=2) + '\n')
    full = ROOT / 'dist/forest-collection-fulltree'
    for name in original['models']:
        for file in (OUT / name).rglob('*'):
            if not file.is_file():
                continue
            relative = file.relative_to(OUT / name)
            data = (SOURCE / name / (f'{name}_1k.gltf' if relative.name == f'{name}.gltf' else relative)).read_bytes() if name == 'fir_sapling' and relative.suffix in ['.gltf', '.bin'] else file.read_bytes()
            destination = full / name / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            if destination.exists() and destination.read_bytes() != data:
                raise FileExistsError('Refuse changed full-needle candidate')
            destination.write_bytes(data)
    print(json.dumps({'textures': len(report['files']), 'bytes': report['textureBytes']}))


if __name__ == '__main__':
    prepare()
