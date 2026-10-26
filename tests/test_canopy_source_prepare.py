from pathlib import Path
import copy
import json
import sys
import unittest

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools'))
from prepare_canopy_source import entries_for

class CanopySourceBoundaries(unittest.TestCase):
    def setUp(self):
        self.row=json.loads((ROOT/'docs/canopy-authored-source-selection.json').read_text())['island_tree_02']

    def test_real_declared_geometry_and_png_are_allowed_without_network(self):
        files=entries_for('island_tree_02',self.row)
        self.assertEqual(len(files),12)
        self.assertEqual(files['island_tree_02.bin']['size'],40686576)
        self.assertTrue(any(k.endswith('.png') for k in files))

    def test_unapproved_models_and_hosts_are_rejected(self):
        with self.assertRaises(ValueError):entries_for('jacaranda_tree',self.row)
        for url in ['http://dl.polyhaven.org/file/ph-assets/Models/a','https://example.com/file/ph-assets/Models/a','https://dl.polyhaven.org/private/a']:
            row=copy.deepcopy(self.row);row['url']=url
            with self.subTest(url=url),self.assertRaises(ValueError):entries_for('island_tree_02',row)

    def test_unsafe_dependencies_and_oversize_are_rejected(self):
        for name in ['../outside.bin','/outside.bin','textures/run.py','textures/../../outside.jpg']:
            row=copy.deepcopy(self.row);row['include'][name]=copy.deepcopy(row['include']['island_tree_02.bin'])
            with self.subTest(name=name),self.assertRaises(ValueError):entries_for('island_tree_02',row)
        row=copy.deepcopy(self.row);row['include']['island_tree_02.bin']['size']=80*1024*1024
        with self.assertRaises(ValueError):entries_for('island_tree_02',row)

if __name__=='__main__':unittest.main()
