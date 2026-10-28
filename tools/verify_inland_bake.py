"""Validate generated color/normal images, including nonempty matching coverage."""
from pathlib import Path
import argparse
import hashlib
import json
import math
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]

def verify(folder):
    files=sorted(folder.glob('*.png'));assert len(files)==8,'Expected one mature tree, four views and two channels'
    rows=[]
    for name in ['jacaranda_tree']:
        for view in range(4):
            pair=[]
            for kind in ['color','normal']:
                path=folder/f'{name}-{view}-{kind}.png'
                with Image.open(path) as image:
                    assert image.mode=='RGBA' and image.size==(1024,1024)
                    data=list(image.get_flattened_data() if hasattr(image,'get_flattened_data') else image.getdata());alpha=[p[3] for p in data]
                    coverage=sum(a>127 for a in alpha)/len(alpha)
                    assert .02<coverage<.8,('Empty or solid bake',path.name,coverage)
                    if kind=='normal':
                        lengths=[math.sqrt(sum((c/255*2-1)**2 for c in p[:3])) for p in data if p[3]>250]
                        assert lengths and sum(abs(n-1)<.1 for n in lengths)/len(lengths)>.97,('Invalid encoded normals',path.name)
                    pair.append(alpha)
                    rows.append(dict(file=path.name,bytes=path.stat().st_size,sha256=hashlib.sha256(path.read_bytes()).hexdigest(),coverage=coverage))
            assert pair[0]==pair[1],('Color/normal coverage mismatch',name,view)
    report=dict(verified=True,folder=str(folder.relative_to(ROOT)),files=rows,productionIntegrated=False)
    (ROOT/'docs/inland-authored-bake-verification.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(dict(verified=True,files=len(rows),bytes=sum(r['bytes'] for r in rows),coverageRange=[min(r['coverage'] for r in rows),max(r['coverage'] for r in rows)])))

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--folder',type=Path,default=ROOT/'dist/inland-authored-candidate/impostors-r1');args=parser.parse_args();verify(args.folder.resolve())
