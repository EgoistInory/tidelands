import importlib.util
import io
import stat
import unittest
import zipfile
from pathlib import Path

spec = importlib.util.spec_from_file_location('staging', Path(__file__).resolve().parents[1] / 'tools/stage_authored_models.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ModelStaging(unittest.TestCase):
    def test_only_plain_local_filenames_are_accepted(self):
        self.assertEqual(module.local_name('Body_Normal.png'), 'Body_Normal.png')
        for uri in ['../escape.bin', '/private/file', 'a/b.bin', 'a\\b.bin', 'https://example.invalid/file', '%2e%2e%2fsecret', 'data:abc']:
            with self.assertRaises(ValueError):
                module.local_name(uri)

    def test_zip_symlinks_and_oversized_members_are_rejected(self):
        data = io.BytesIO()
        with zipfile.ZipFile(data, 'w') as archive:
            entry = zipfile.ZipInfo('link.bin')
            entry.external_attr = (stat.S_IFLNK | 0o777) << 16
            archive.writestr(entry, 'outside')
            archive.writestr('body.bin', b'12345')
        with zipfile.ZipFile(io.BytesIO(data.getvalue())) as archive:
            with self.assertRaises(ValueError):
                module.read_member(archive, 'link.bin')
            with self.assertRaises(ValueError):
                module.read_member(archive, 'body.bin', limit=4)

    def test_texture_remaps_are_explicit_and_do_not_guess_other_names(self):
        self.assertEqual(module.TEXTURE_REMAP['T_Eye_Normal_png.png'], 'T_Eye_Normal.png')
        self.assertEqual(module.TEXTURE_REMAP['T_Hair_1_Normal_png.png'], 'T_Hair_1_Normal.png')
        self.assertNotIn('unknown.png', module.TEXTURE_REMAP)


if __name__ == '__main__':
    unittest.main()
