"""Pack official diffuse/opacity data for alpha-masked leaf patches, offline only."""
from pathlib import Path
import hashlib
import io
import json
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'dist/canopy-authored-source'
OUT=ROOT/'dist/canopy-authored-candidate'

def prepare():
    report=dict(models={},productionIntegrated=False,license='CC0-1.0')
    for name in ['island_tree_01','island_tree_02','island_tree_03']:
        acquired=json.loads((SOURCE/name/'acquisition.json').read_text());records={}
        def original(relative):
            data=(SOURCE/name/relative).read_bytes()
            assert hashlib.sha256(data).hexdigest()==acquired['files'][relative]['sha256']
            return data
        doc=json.loads((OUT/name/f'{name}_near.gltf').read_text())
        for image in doc['images']:
            relative=image['uri'];path=OUT/name/relative
            if relative.endswith('_rgba_512.png'):
                diffuse=Image.open(io.BytesIO(original(f'textures/{name}_leaves_diff_1k.jpg'))).convert('RGB')
                opacity=Image.open(io.BytesIO(original(f'textures/{name}_leaves_alpha_1k.png'))).convert('L')
                assert diffuse.size==opacity.size
                diffuse.putalpha(opacity);bitmap=diffuse.resize((512,512),Image.Resampling.LANCZOS)
                assert bitmap.getchannel('A').getextrema()==(0,255)
            else:
                bitmap=Image.open(io.BytesIO(original(relative))).convert('RGB');bitmap.thumbnail((512,512),Image.Resampling.LANCZOS)
            stream=io.BytesIO();bitmap.save(stream,format='PNG' if relative.endswith('.png') else 'JPEG',**({} if relative.endswith('.png') else {'quality':90}))
            data=stream.getvalue();path.parent.mkdir(parents=True,exist_ok=True)
            if path.exists() and path.read_bytes()!=data:raise FileExistsError('Refuse different existing texture')
            path.write_bytes(data);records[relative]=dict(bytes=len(data),sha256=hashlib.sha256(data).hexdigest(),size=list(bitmap.size))
        report['models'][name]=records
    report['textureBytes']=sum(v['bytes'] for files in report['models'].values() for v in files.values())
    (OUT/'texture-manifest.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(dict(textures=sum(len(v) for v in report['models'].values()),bytes=report['textureBytes'])))

if __name__=='__main__':prepare()
