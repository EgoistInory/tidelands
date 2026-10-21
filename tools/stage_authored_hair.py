"""Stage four fixed origin-space CC0 hairstyles without changing the body staging."""
import json
import zipfile
from pathlib import Path
from stage_authored_models import ROOT, ARCHIVES, digest, local_name, read_member

HAIR = ('Hair_SimpleParted', 'Hair_Buzzed', 'Hair_Buns', 'Hair_Long')

if __name__ == '__main__':
    destination = ROOT / 'dist/authored-hair'
    if destination.exists():
        raise FileExistsError('Hair directory already exists; inspect rather than overwrite')
    path = ROOT / 'dist/authored-source' / ARCHIVES['base'][0]
    if digest(path.read_bytes()) != ARCHIVES['base'][1]:
        raise ValueError('Author archive fingerprint changed')
    files = {}
    with zipfile.ZipFile(path) as archive:
        prefix = 'Universal Base Characters[Standard]/'
        files['LICENSE.txt'] = read_member(archive, prefix + 'License_Standard.txt', 4096)
        folder = prefix + 'Hairstyles/Origin at 0/glTF (Godot)/'
        for name in HAIR:
            data = read_member(archive, folder + name + '.gltf')
            doc = json.loads(data)
            if doc.get('skins') or doc.get('animations'):
                raise ValueError('Expected static origin-space hair')
            files[name + '.gltf'] = data
            for key in ('buffers', 'images'):
                for reference in doc.get(key, []):
                    filename = local_name(reference['uri'])
                    value = read_member(archive, folder + filename)
                    if filename in files and files[filename] != value:
                        raise ValueError('Conflicting shared hair file')
                    files[filename] = value
    if sum(map(len, files.values())) > 16 * 1024 * 1024:
        raise ValueError('Hair staging budget exceeded')
    destination.mkdir()
    for filename, value in files.items():
        (destination / filename).write_bytes(value)
    report = {'sourceArchiveSha256': ARCHIVES['base'][1], 'sourceFolder': folder,
              'stagedDirectory': 'dist/authored-hair', 'hairstyles': HAIR,
              'files': {n: {'bytes': len(v), 'sha256': digest(v)} for n, v in files.items()},
              'runtimeIntegrated': False}
    (ROOT / 'docs/authored-hair-staging.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({'files': len(files), 'bytes': sum(map(len, files.values()))}))
