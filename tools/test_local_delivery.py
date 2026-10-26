"""Packaging regression checks with isolated inputs; never touch milestone archives."""
import contextlib
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import zipfile

import package_local
import verify_local


class LocalDeliveryTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory(prefix='tidelands-package-test-')
        self.addCleanup(self.folder.cleanup)
        self.root = Path(self.folder.name)
        files = {'index.html': '<title>checkpoint</title>', 'styles.css': 'body{margin:0}',
                 'serve.py': (package_local.ROOT / 'serve.py').read_text(),
                 'src/sky.js': 'export const sky = true;', 'docs/LOCAL-DELIVERY.md': 'Local instructions',
                 'assets/ground/manifest.json': '{}', 'assets/ground/test.jpg': 'fixture'}
        files.update({'vendor/' + name: name for name in ('three.module.min.js', 'three.core.min.js', 'THREE-LICENSE', 'README.md')})
        for name, data in files.items():
            path = self.root / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(data)
        self.addCleanup(patch.stopall)
        patch.object(package_local, 'ROOT', self.root).start()
        patch.object(verify_local, 'ROOT', self.root).start()

    def build(self):
        with contextlib.redirect_stdout(io.StringIO()):
            return package_local.build('tidelands-m5-test', 'M5 quality batch checkpoint')

    def test_versioned_archive_is_reproducible_and_verifies(self):
        report = self.build()
        archive = self.root / 'dist/tidelands-m5-test.zip'
        first = archive.read_bytes()
        self.assertEqual(self.build(), report)
        self.assertEqual(archive.read_bytes(), first)
        with zipfile.ZipFile(archive) as packed:
            self.assertEqual(packed.read('tidelands-local/src/sky.js'), b'export const sky = true;')
            self.assertEqual(packed.read('tidelands-local/README.md'), b'Local instructions')
        with contextlib.redirect_stdout(io.StringIO()):
            verification = verify_local.verify('tidelands-m5-test')
        self.assertTrue(verification['passed'])
        self.assertFalse(verification['fullGoalComplete'])
        self.assertEqual(verification['archiveSha256'], report['archiveSha256'])
        self.assertEqual(json.loads((self.root / 'docs/tidelands-m5-test-verification.json').read_text()), verification)

    def test_character_manifest_assets_and_local_addons_are_included(self):
        import hashlib
        folder=self.root/'assets/characters';folder.mkdir()
        contents={'body.gltf':b'{"asset":{"version":"2.0"}}','body.bin':b'buffer','body.png':b'png','Base-LICENSE.txt':b'CC0'}
        manifest={'files':{name:{'sha256':hashlib.sha256(data).hexdigest()}for name,data in contents.items()}}
        for name,data in contents.items():(folder/name).write_bytes(data)
        (folder/'provenance.json').write_text(json.dumps(manifest));(folder/'action-landmarks.json').write_text('{}')
        for name in ['loaders/GLTFLoader.js','utils/BufferGeometryUtils.js','README.md']:
            path=self.root/'vendor/addons'/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_text('local add-on')
        report=self.build()
        self.assertEqual(report['archive'],'tidelands-m5-test.zip')
        for name in contents:self.assertIn('assets/characters/'+name,report['files'])
        self.assertIn('vendor/addons/loaders/GLTFLoader.js',report['files'])
        manifest['files']['../escape.bin']={'sha256':'0'*64};(folder/'provenance.json').write_text(json.dumps(manifest))
        with self.assertRaises(ValueError):self.build()

    def test_changed_inputs_cannot_replace_existing_checkpoint(self):
        self.build()
        before = {p.name: p.read_bytes() for p in (self.root / 'dist').iterdir()}
        (self.root / 'index.html').write_text('changed runtime')
        with self.assertRaises(FileExistsError):
            self.build()
        self.assertEqual({p.name: p.read_bytes() for p in (self.root / 'dist').iterdir()}, before)

    def test_woodland_manifest_includes_local_geometry_and_rejects_changed_or_escaping_files(self):
        import hashlib
        folder=self.root/'assets/woodland';folder.mkdir()
        data=b'local geometry';(folder/'plant.bin').write_bytes(data)
        manifest={'files':{'plant.bin':{'sha256':hashlib.sha256(data).hexdigest()}}}
        (folder/'provenance.json').write_text(json.dumps(manifest))
        for name in ['loaders/GLTFLoader.js','utils/BufferGeometryUtils.js','README.md']:
            path=self.root/'vendor/addons'/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_text('local add-on')
        self.assertIn('assets/woodland/plant.bin',self.build()['files'])
        (folder/'plant.bin').write_bytes(b'changed')
        with self.assertRaises(ValueError):self.build()
        manifest['files']={'../escape.bin':{'sha256':'0'*64}};(folder/'provenance.json').write_text(json.dumps(manifest))
        with self.assertRaises(ValueError):self.build()

    def test_names_cannot_escape_dist(self):
        for name in ('../checkpoint', '/tmp/checkpoint', 'checkpoint.zip', ''):
            with self.subTest(name=name), self.assertRaises(ValueError):
                package_local.build(name, 'M5 checkpoint')

    def test_report_manifest_disagreement_is_rejected(self):
        self.build()
        path = self.root / 'dist/tidelands-m5-test.json'
        report = json.loads(path.read_text())
        report['files']['src/sky.js']['sha256'] = '0' * 64
        path.write_text(json.dumps(report))
        with self.assertRaisesRegex(AssertionError, 'Build report manifest mismatch'):
            verify_local.verify('tidelands-m5-test')


if __name__ == '__main__':
    unittest.main()
