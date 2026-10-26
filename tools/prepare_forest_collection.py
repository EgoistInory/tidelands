"""Acquire a bounded CC0 forest subset into an isolated directory, never runtime assets."""
from pathlib import Path, PurePosixPath
import hashlib
import json
import ssl
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'dist/forest-collection-source'
NAMES = ['fir_sapling', 'fern_02', 'rock_moss_set_01']
LIMIT = 40 * 1024 * 1024


def safe_name(name):
    path = PurePosixPath(name)
    if path.is_absolute() or '..' in path.parts or '\\' in name or ':' in name or '%' in name:
        raise ValueError('Unsafe local dependency')
    return path


def read_asset(row):
    url = urllib.parse.urlsplit(row['url'])
    if url.scheme != 'https' or url.netloc != 'dl.polyhaven.org' or not url.path.startswith('/file/ph-assets/Models/'):
        raise ValueError('Unexpected asset host or path')
    if not 0 < row['size'] < 28 * 1024 * 1024:
        raise ValueError('Asset exceeds bounded per-file budget')
    context = ssl.create_default_context(cafile='/etc/ssl/cert.pem')
    request = urllib.request.Request(row['url'], headers={'User-Agent': 'Tidelands-local-asset-review/1.0'})
    with urllib.request.urlopen(request, context=context, timeout=45) as response:
        if urllib.parse.urlsplit(response.url).netloc != 'dl.polyhaven.org':
            raise ValueError('Unexpected redirect host')
        data = response.read(row['size'] + 1)
    if len(data) != row['size'] or hashlib.md5(data).hexdigest() != row['md5']:
        raise ValueError('Source byte count or published checksum mismatch')
    return data


def prepare():
    selection = json.loads((ROOT / 'docs/forest-collection-source-selection.json').read_text())
    metadata = {name: selection[name] for name in NAMES}
    declared = sum(row['size'] + sum(v['size'] for v in row.get('include', {}).values()) for row in metadata.values())
    if declared > LIMIT:
        raise ValueError('Forest subset exceeds total budget')
    OUT.mkdir(parents=True, exist_ok=True)
    report = {'kind': 'isolated-cc0-forest-acquisition', 'author': 'Poly Haven contributors',
              'license': 'CC0-1.0', 'licensePage': 'https://polyhaven.com/license',
              'collectionPage': 'https://polyhaven.com/collections/pine_forest',
              'route': 'agent-reach source routing; built-in official search, no paid search API',
              'declaredSourceBytes': declared, 'files': {}, 'models': {},
              'productionIntegrated': False, 'visualAccepted': False, 'fullGoalComplete': False}
    for name, row in metadata.items():
        entries = {f'{name}_1k.gltf': row, **row.get('include', {})}
        target_root = OUT / name
        for relative, item in entries.items():
            path = target_root / safe_name(relative)
            if path.exists():
                data = path.read_bytes()
                if len(data) != item['size'] or hashlib.md5(data).hexdigest() != item['md5']:
                    raise FileExistsError('Refuse different existing source file')
            else:
                data = read_asset(item)
                path.parent.mkdir(parents=True, exist_ok=True)
                with path.open('xb') as stream:
                    stream.write(data)
            report['files'][str(path.relative_to(OUT))] = dict(bytes=len(data), sha256=hashlib.sha256(data).hexdigest(), publishedMd5=item['md5'], url=item['url'])
        doc = json.loads((target_root / f'{name}_1k.gltf').read_text())
        if doc.get('skins') or doc.get('animations') or doc.get('extensionsRequired'):
            raise ValueError('Static plain glTF subset required')
        for item in doc.get('buffers', []) + doc.get('images', []):
            if item['uri'] not in row['include'] or not (target_root / safe_name(item['uri'])).is_file():
                raise ValueError('Unlisted or missing local dependency')
        report['models'][name] = {'meshes': len(doc['meshes']), 'materials': len(doc['materials']),
                                 'primitives': [{'mesh': m.get('name'), 'triangles': sum(doc['accessors'][p['indices']]['count'] // 3 for p in m['primitives'])} for m in doc['meshes']]}
    report['actualSourceBytes'] = sum(v['bytes'] for v in report['files'].values())
    (OUT / 'manifest.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({k: report[k] for k in ['actualSourceBytes', 'models', 'productionIntegrated', 'visualAccepted']}))


if __name__ == '__main__':
    prepare()
