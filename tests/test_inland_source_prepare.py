import sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
from prepare_inland_source import inland_entries

class InlandSourceSafety(unittest.TestCase):
    def row(self,name='jacaranda_tree'):
        return {'url':f'https://dl.polyhaven.org/file/ph-assets/Models/gltf/1k/{name}/{name}_1k.gltf','size':500,'md5':'0'*32,'include':{f'{name}.bin':{'url':f'https://dl.polyhaven.org/file/ph-assets/Models/gltf/8k/{name}/{name}.bin','size':208307808,'md5':'1'*32}}}
    def test_declared_large_inland_tree_fits_explicit_bounded_source_budget(self):
        self.assertEqual(len(inland_entries('jacaranda_tree',self.row())),2)
    def test_other_assets_and_remote_hosts_are_rejected(self):
        with self.assertRaises(ValueError):inland_entries('tree_small_02',self.row('tree_small_02'))
        row=self.row();row['url']=row['url'].replace('dl.polyhaven.org','example.com')
        with self.assertRaises(ValueError):inland_entries('jacaranda_tree',row)
    def test_escaping_paths_unbounded_sizes_and_invalid_checksum_are_rejected(self):
        for mutation in ['path','size','md5']:
            row=self.row()
            if mutation=='path':row['include']['../escape.bin']=row['include'].pop('jacaranda_tree.bin')
            elif mutation=='size':row['include']['jacaranda_tree.bin']['size']=300*1024*1024
            else:row['include']['jacaranda_tree.bin']['md5']='invalid'
            with self.subTest(mutation=mutation),self.assertRaises(ValueError):inland_entries('jacaranda_tree',row)

if __name__=='__main__':unittest.main()
