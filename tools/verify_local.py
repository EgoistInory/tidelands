"""Verify and unpack the local checkpoint for a separate launch smoke test."""
import argparse
import ast
import hashlib
import json
from pathlib import Path, PurePosixPath
import subprocess
import sys
import tempfile
import zipfile
from package_local import validate_name

ROOT = Path(__file__).resolve().parents[1]
PREFIX = 'tidelands-local/'


def verify(checkpoint_name='tidelands-local'):
    validate_name(checkpoint_name)
    archive_path = ROOT / 'dist' / (checkpoint_name + '.zip')
    build_report = json.loads((ROOT / 'dist' / (checkpoint_name + '.json')).read_text())
    archive_hash = hashlib.sha256(archive_path.read_bytes()).hexdigest()
    assert archive_hash == build_report['archiveSha256'], 'Archive hash mismatch'
    assert archive_path.name == build_report['archive'] and archive_path.stat().st_size == build_report['archiveBytes'], 'Archive metadata mismatch'
    with zipfile.ZipFile(archive_path) as archive:
        names = archive.namelist()
        assert len(names) == len(set(names)), 'Duplicate archive paths'
        assert all(name.startswith(PREFIX) and '..' not in PurePosixPath(name).parts for name in names), 'Unsafe archive path'
        assert archive.testzip() is None, 'Archive CRC failure'
        manifest = json.loads(archive.read(PREFIX + 'delivery-manifest.json'))
        assert manifest == {key: value for key, value in build_report.items() if key not in ('archive', 'archiveBytes', 'archiveSha256', 'archiveEntries')}, 'Build report manifest mismatch'
        assert len(names) == build_report['archiveEntries'], 'Archive entry count mismatch'
        assert set(names) == {PREFIX + name for name in manifest['files']} | {PREFIX + 'delivery-manifest.json'}, 'Unexpected or missing files'
        for name, entry in manifest['files'].items():
            data = archive.read(PREFIX + name)
            assert len(data) == entry['bytes'] and hashlib.sha256(data).hexdigest() == entry['sha256'], name
        folder = Path(tempfile.mkdtemp(prefix='tidelands-delivery-', dir='/private/tmp'))
        archive.extractall(folder)
    extracted = folder / 'tidelands-local'
    ast.parse((extracted / 'serve.py').read_text())
    for port in ('-1', '65536'):
        result = subprocess.run([sys.executable, str(extracted / 'serve.py'), '--port', port], capture_output=True, text=True)
        assert result.returncode == 2 and '端口必须在0到65535之间' in result.stderr, port
    report = {'kind': 'local-delivery-archive-check', 'passed': True, 'archive': archive_path.name, 'stage': manifest['stage'], 'archiveSha256': archive_hash,
              'checkedFiles': len(manifest['files']), 'archiveEntries': len(names), 'extractedPath': str(extracted),
              'invalidPortsRejected': [-1, 65536], 'browserLaunchVerified': False, 'fullGoalComplete': False}
    (ROOT / 'docs' / (checkpoint_name + '-verification.json')).write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(report, ensure_ascii=False))
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='校验指定本地包并单独解压')
    parser.add_argument('--name', default='tidelands-local', help='dist 中的包名，不含扩展名')
    args = parser.parse_args()
    verify(args.name)
