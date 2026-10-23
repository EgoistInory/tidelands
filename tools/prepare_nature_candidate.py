"""Prepare an isolated, local CC0 nature art comparison; never modify runtime assets."""
from pathlib import Path, PurePosixPath
import hashlib
import io
import json
import zipfile
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT / 'dist/authored-nature-source/Stylized-Nature-MegaKit-Standard.zip'
EXPECTED = '298f6732b872e4cf7b30e6e7abf9641c7f6dc6b326df37ac089533ed7e3d58c9'
MODELS = ['CommonTree_1', 'CommonTree_2', 'CommonTree_3', 'Pine_1', 'Pine_2', 'Pine_3',
          'Bush_Common', 'Fern_1', 'Plant_1', 'Flower_3_Group', 'Grass_Wispy_Short']
OUT = ROOT / 'dist/nature-candidate'
sha = lambda data: hashlib.sha256(data).hexdigest()


def prepare():
    data = ARCHIVE.read_bytes()
    if sha(data) != EXPECTED:
        raise ValueError('Source archive SHA mismatch')
    OUT.mkdir(parents=True, exist_ok=True)
    files, models = {}, {}
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        license_data = archive.read('License_Standard.txt')
        if b'CC0 1.0 Universal' not in license_data or b'(68/116)' not in license_data:
            raise ValueError('Expected free Standard license not present')
        wanted = {'License_Standard.txt'}
        for name in MODELS:
            member = 'glTF/' + name + '.gltf'
            doc = json.loads(archive.read(member))
            if doc.get('extensionsRequired') or doc.get('animations') or doc.get('skins'):
                raise ValueError('Candidate must be a plain static glTF')
            wanted.add(member)
            for row in doc.get('buffers', []) + doc.get('images', []):
                uri = row['uri']
                if PurePosixPath(uri).name != uri or ':' in uri or '\\' in uri:
                    raise ValueError('Nonlocal glTF dependency')
                wanted.add('glTF/' + uri)
            models[name] = {'triangles': sum(doc['accessors'][p['indices']]['count'] // 3
                for mesh in doc['meshes'] for p in mesh['primitives']),
                'materials': len(doc['materials'])}
        for member in sorted(wanted):
            source = archive.read(member)
            result = source
            row = {'sourceMember': member, 'sourceSha256': sha(source)}
            if member.endswith('.png'):
                with Image.open(io.BytesIO(source)) as image:
                    row['sourceSize'] = list(image.size)
                    image.thumbnail((512, 512), Image.Resampling.LANCZOS)
                    output = io.BytesIO()
                    image.save(output, format='PNG', optimize=True)
                    result = output.getvalue()
                    row['candidateSize'] = list(image.size)
            row.update(bytes=len(result), sha256=sha(result))
            target = OUT / PurePosixPath(member).name
            if target.exists() and target.read_bytes() != result:
                raise FileExistsError('Refuse to overwrite different candidate: ' + target.name)
            target.write_bytes(result)
            files[target.name] = row
    report = {'kind': 'isolated-authored-nature-source-audit', 'sourceArchive': str(ARCHIVE.relative_to(ROOT)),
        'archiveBytes': len(data), 'archiveSha256': EXPECTED,
        'author': 'Quaternius', 'license': 'CC0-1.0', 'version': 'Standard free 68/116 models',
        'officialPage': 'https://quaternius.com/packs/stylizednaturemegakit.html',
        'downloadPage': 'https://quaternius.itch.io/stylized-nature-megakit',
        'models': models, 'files': files, 'candidateBytes': sum(row['bytes'] for row in files.values()),
        'productionIntegrated': False, 'fullGoalComplete': False,
        'limits': ['Official full-pack 116 count is not the acquired free 68 model count.',
                   'No paid Pro/Source shaders or engine projects acquired.',
                   'Acquisition and bounded CPU/file budget are not visual, GPU or final quality acceptance.']}
    (ROOT / 'docs/nature-candidate-source.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({k: report[k] for k in ['archiveBytes', 'archiveSha256', 'candidateBytes', 'productionIntegrated']}))


if __name__ == '__main__':
    prepare()
