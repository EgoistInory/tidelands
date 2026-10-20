"""Stage fixed CC0 candidates for isolated review. Never adds assets to production."""
import base64
import hashlib
import importlib.util
import json
import stat
import struct
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TEXTURE_REMAP = {'T_Eye_Normal_png.png': 'T_Eye_Normal.png', 'T_Hair_1_Normal_png.png': 'T_Hair_1_Normal.png'}
ARCHIVES = {
    'base': ('Universal Base Characters[Standard].zip', 'fdbf1804c90dfc1ea03e992bff7da2dfd1a79318e13270a660180f9308455f40'),
    'animations': ('Universal Animation Library[Standard].zip', 'cc73fc4e495b82958207316596317a3f40b9fa38065bde1027937452da537724'),
}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def local_name(uri):
    if not isinstance(uri, str) or not uri or any(c in uri for c in '/\\:%?#') or uri in ('.', '..'):
        raise ValueError('Only a plain local filename is allowed')
    return uri


def read_member(archive, name, limit=16 * 1024 * 1024):
    matches = [i for i in archive.infolist() if i.filename == name]
    if len(matches) != 1:
        raise ValueError('Missing or duplicate archive member')
    item = matches[0]
    if item.is_dir() or stat.S_ISLNK(item.external_attr >> 16) or item.file_size > limit:
        raise ValueError('Unsupported member type or size')
    return archive.read(item)


def stage():
    destination = ROOT / 'dist/authored-review'
    if destination.exists():
        raise FileExistsError('Review directory already exists; inspect it instead of overwriting')
    spec = importlib.util.spec_from_file_location('gltf_inventory', ROOT / 'tools/inspect_authored_gltf.py')
    inspector = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(inspector)
    files, models, licenses = {}, {}, {}
    for kind, (filename, expected) in ARCHIVES.items():
        path = ROOT / 'dist/authored-source' / filename
        if digest(path.read_bytes()) != expected:
            raise ValueError('Archive fingerprint differs from the inspected author download')
    with zipfile.ZipFile(ROOT / 'dist/authored-source' / ARCHIVES['base'][0]) as archive:
        prefix = 'Universal Base Characters[Standard]/'
        license_data = read_member(archive, prefix + 'License_Standard.txt', 4096)
        if b'CC0 1.0 Universal' not in license_data:
            raise ValueError('Expected author CC0 license is absent')
        files['Base-LICENSE.txt'] = license_data
        licenses['base'] = digest(license_data)
        folder = prefix + 'Base Characters/Godot - UE/'
        for sex in ('Male', 'Female'):
            name = f'Superhero_{sex}_FullBody.gltf'
            source = read_member(archive, folder + name)
            doc = json.loads(source)
            embedded = json.loads(source)
            remaps = []
            textures = []
            for key, mime in [('buffers', 'application/octet-stream'), ('images', 'image/png')]:
                for index, item in enumerate(doc.get(key, [])):
                    uri = local_name(item['uri'])
                    actual = TEXTURE_REMAP.get(uri, uri)
                    data = read_member(archive, folder + actual)
                    if actual in files and files[actual] != data:
                        raise ValueError('Conflicting staged filenames')
                    files[actual] = data
                    if actual != uri:
                        remaps.append({'sourceUri': uri, 'actualArchiveFile': actual})
                    item['uri'] = actual
                    embedded[key][index]['uri'] = 'data:' + mime + ';base64,' + base64.b64encode(data).decode()
                    if key == 'images':
                        if not data.startswith(b'\x89PNG\r\n\x1a\n'):
                            raise ValueError('Expected PNG image signature')
                        width, height = struct.unpack('>II', data[16:24])
                        if width * height > 2048 * 2048:
                            raise ValueError('Texture exceeds this isolated review allowance')
                        textures.append({'file': actual, 'width': width, 'height': height, 'sha256': digest(data)})
            inventory = inspector.inspect_bytes(json.dumps(embedded).encode())
            inventory.update(sourceMember=folder + name, sourceGltfSha256=digest(source), textureRemaps=remaps,
                             textures=textures, licenseVerified=True, sourceHasAnimations=bool(doc.get('animations')))
            models[sex.lower()] = inventory
            files[name] = (json.dumps(doc, indent=2) + '\n').encode()
    with zipfile.ZipFile(ROOT / 'dist/authored-source' / ARCHIVES['animations'][0]) as archive:
        prefix = 'Universal Animation Library[Standard]/'
        license_data = read_member(archive, prefix + 'License.txt', 4096)
        if b'CC0 1.0 Universal' not in license_data:
            raise ValueError('Expected animation CC0 license is absent')
        files['Animation-LICENSE.txt'] = license_data
        licenses['animations'] = digest(license_data)
        data = read_member(archive, prefix + 'Unreal-Godot/UAL1_Standard.glb')
        files['UAL1_Standard.glb'] = data
        models['animations'] = inspector.inspect_bytes(data)
        models['animations']['licenseVerified'] = True
    if sum(map(len, files.values())) > 64 * 1024 * 1024:
        raise ValueError('Staged files exceed allowance')
    # All references and files have been checked before creating an isolated directory.
    destination.mkdir()
    for name, data in files.items():
        (destination / local_name(name)).write_bytes(data)
    report = {'archives': {key: {'filename': row[0], 'sha256': row[1]} for key, row in ARCHIVES.items()},
              'licenses': licenses, 'models': models, 'stagedDirectory': 'dist/authored-review',
              'files': {name: {'bytes': len(data), 'sha256': digest(data)} for name, data in files.items()},
              'rawArchivesModified': False, 'runtimeIntegrated': False, 'renderedSuitabilityVerified': False,
              'scope': 'Fixed author CC0 models/animations, archive-only local-reference resolution and explicit texture filename repairs. No production character adoption, outfit or animation retarget acceptance.'}
    (ROOT / 'docs/authored-model-staging.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({'files': len(files), 'models': {key: {'triangles': value['triangles'], 'joints': value['skins'][0]['jointCount'], 'animations': len(value['animations'])} for key, value in models.items()}, 'runtimeIntegrated': False}))


if __name__ == '__main__':
    stage()
