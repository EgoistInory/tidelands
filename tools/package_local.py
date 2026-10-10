"""Build a reproducible local-only playable checkpoint using explicit runtime inputs."""
import argparse
import hashlib
import io
import json
from pathlib import Path
import re
import zipfile

ROOT = Path(__file__).resolve().parents[1]
PREFIX = 'tidelands-local/'


def validate_name(name):
    if not re.fullmatch(r'[a-zA-Z0-9][a-zA-Z0-9_-]*', name):
        raise ValueError('包名只能包含字母、数字、连字符或下划线，不含目录或扩展名')
    return name


def build(name='tidelands-local', stage='M1-M4 functional checkpoint'):
    validate_name(name)
    paths = [Path(name) for name in ('index.html', 'styles.css', 'serve.py')]
    paths += sorted(Path('src') / p.name for p in (ROOT / 'src').glob('*.js'))
    paths += [Path('vendor') / name for name in ('three.module.min.js', 'three.core.min.js', 'THREE-LICENSE', 'README.md')]
    paths += sorted(p.relative_to(ROOT) for p in (ROOT / 'assets').rglob('*') if p.is_file() and p.suffix in ('.jpg', '.json'))
    contents = {str(p): (ROOT / p).read_bytes() for p in paths}
    contents['README.md'] = (ROOT / 'docs/LOCAL-DELIVERY.md').read_bytes()
    manifest = {
        'project': '潮生群岛', 'stage': stage, 'fullGoalComplete': False,
        'builderSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        'files': {name: {'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()} for name, data in sorted(contents.items())},
    }
    contents['delivery-manifest.json'] = (json.dumps(manifest, ensure_ascii=False, indent=2) + '\n').encode()
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for entry_name, data in sorted(contents.items()):
            info = zipfile.ZipInfo(PREFIX + entry_name, date_time=(1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, data)
    data = buffer.getvalue()
    out = ROOT / 'dist'
    out.mkdir(exist_ok=True)
    archive_path = out / (name + '.zip')
    report = {**manifest, 'archive': archive_path.name, 'archiveBytes': len(data), 'archiveSha256': hashlib.sha256(data).hexdigest(), 'archiveEntries': len(contents)}
    outputs = {archive_path: data, out / (name + '.json'): (json.dumps(report, ensure_ascii=False, indent=2) + '\n').encode()}
    # Keep accepted checkpoints immutable; an identical rebuild is a no-op.
    for path, content in outputs.items():
        if path.exists() and path.read_bytes() != content:
            raise FileExistsError(f'已有检查点不能覆盖：{path.name}；请用 --name 选择新版本')
    for path, content in outputs.items():
        if not path.exists():
            path.write_bytes(content)
    print(json.dumps({key: report[key] for key in ('archive', 'archiveBytes', 'archiveSha256', 'archiveEntries')}, ensure_ascii=False))
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='构建不可覆盖的本地游戏检查点')
    parser.add_argument('--name', default='tidelands-local', help='dist 中的包名，不含扩展名；新阶段使用新名字')
    parser.add_argument('--stage', default='M1-M4 functional checkpoint', help='本包实际阶段，完整目标仍未完成')
    args = parser.parse_args()
    try:
        build(args.name, args.stage)
    except (ValueError, FileExistsError) as error:
        parser.error(str(error))
