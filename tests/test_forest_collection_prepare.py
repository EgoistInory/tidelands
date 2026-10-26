import importlib.util
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('forest_collection', ROOT / 'tools/prepare_forest_collection.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ForestAcquisitionBoundaries(unittest.TestCase):
    def test_dependencies_cannot_escape_the_isolated_directory(self):
        for name in ['../secret', '/absolute', 'textures/../../secret', 'https://example.com/a', r'textures\a', '%2e%2e/a']:
            with self.subTest(name=name), self.assertRaises(ValueError):
                module.safe_name(name)

    def test_host_and_scheme_are_rejected_before_network(self):
        for url in ['http://dl.polyhaven.org/file/ph-assets/Models/a', 'https://example.com/file/ph-assets/Models/a', 'https://dl.polyhaven.org/private/a']:
            with self.subTest(url=url), self.assertRaises(ValueError):
                module.read_asset({'url': url, 'size': 32, 'md5': '0' * 32})

    def test_oversized_file_is_rejected_before_network(self):
        with self.assertRaises(ValueError):
            module.read_asset({'url': 'https://dl.polyhaven.org/file/ph-assets/Models/a', 'size': 28 * 1024 * 1024, 'md5': '0' * 32})


if __name__ == '__main__':
    unittest.main()
