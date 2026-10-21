"""Prepare local derived actor assets with bounded texture sizes, retaining original archives."""
import hashlib
import json
from pathlib import Path
import struct
import subprocess
from stage_authored_models import ROOT, local_name

def digest(data): return hashlib.sha256(data).hexdigest()
if __name__ == '__main__':
    destination = ROOT/'assets/characters'
    if destination.exists(): raise FileExistsError('Runtime character folder exists; inspect rather than overwrite')
    files={}
    for manifest in ['authored-model-staging.json','authored-hair-staging.json']:
        report=json.loads((ROOT/'docs'/manifest).read_text())
        for name,row in report['files'].items():
            name=local_name(name);data=(ROOT/report['stagedDirectory']/name).read_bytes()
            assert digest(data)==row['sha256']
            if name in files and files[name]!=data: raise ValueError('Conflicting source basename')
            files[name]=data
    assert sum(map(len,files.values()))<64*1024*1024
    destination.mkdir(parents=True)
    rows={};rgba_mips=0
    for name,data in files.items():
        target=destination/name
        if name.endswith('.png'):
            assert data[:8]==b'\x89PNG\r\n\x1a\n';w,h=struct.unpack('>II',data[16:24]);source=next(ROOT/json.loads((ROOT/'docs'/m).read_text())['stagedDirectory']/name for m in ['authored-model-staging.json','authored-hair-staging.json'] if name in json.loads((ROOT/'docs'/m).read_text())['files'])
            if max(w,h)>512: subprocess.run(['/usr/bin/sips','-Z','512',str(source),'--out',str(target)],check=True,timeout=30,capture_output=True)
            else: target.write_bytes(data)
            actual=target.read_bytes();w2,h2=struct.unpack('>II',actual[16:24]);assert max(w2,h2)<=512;rgba_mips+=w2*h2*4*4/3
            rows[name]={'sourceSha256':digest(data),'sha256':digest(actual),'bytes':len(actual),'sourceSize':[w,h],'runtimeSize':[w2,h2]}
        else:
            target.write_bytes(data);rows[name]={'sourceSha256':digest(data),'sha256':digest(data),'bytes':len(data)}
    # The official r180 add-ons are preserved except for explicit local Three imports.
    vendor={}
    for folder,name in [('loaders','GLTFLoader.js'),('utils','BufferGeometryUtils.js')]:
        source=ROOT/'tests/vendor/r180'/folder/name;original=source.read_text();assert original.count("from 'three'")==1
        derived=original.replace("from 'three'","from '../../three.module.min.js'");target=ROOT/'vendor/addons'/folder/name;target.parent.mkdir(parents=True,exist_ok=True)
        if target.exists(): raise FileExistsError('Derived add-on exists')
        target.write_text(derived);vendor[str(target.relative_to(ROOT))]={'officialSourceSha256':digest(source.read_bytes()),'sha256':digest(target.read_bytes()),'change':'Only three import made relative; same r180 as existing vendor'}
    report={'files':rows,'vendor':vendor,'estimatedUniqueTextureRgbaMipBytes':round(rgba_mips),'textureMaxEdge':512,'scope':'Derived local runtime candidate; PNG technical resampling only, original archives/staging untouched. Texture estimate is not measured VRAM.'}
    (destination/'provenance.json').write_text(json.dumps(report,indent=2)+'\n')
    (ROOT/'docs/authored-runtime-assets.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({'files':len(rows),'bytes':sum(r['bytes']for r in rows.values()),'estimatedUniqueTextureRgbaMipBytes':round(rgba_mips)}))
