"""Download only the declared official CC0 coastal tree files to isolated storage."""
from pathlib import Path
import argparse
import hashlib
import json
import ssl
import urllib.parse
import urllib.request
from prepare_forest_collection import safe_name

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'dist/canopy-authored-source'
NAMES=['island_tree_01','island_tree_02','island_tree_03']

def entries_for(name,row):
    if name not in NAMES:raise ValueError('Unapproved model')
    entries={f'{name}_1k.gltf':row,**row.get('include',{})}
    for relative,item in entries.items():
        safe_name(relative)
        url=urllib.parse.urlsplit(item['url'])
        if url.scheme!='https' or url.netloc!='dl.polyhaven.org' or not url.path.startswith('/file/ph-assets/Models/'):
            raise ValueError('Unapproved source')
        if Path(relative).suffix not in ['.gltf','.bin','.jpg','.png'] or not 0<item['size']<80*1024*1024:
            raise ValueError('Unapproved file kind or size')
    return entries

def prepare(name,metadata_only=False):
    selection=json.loads((ROOT/'docs/canopy-authored-source-selection.json').read_text())
    total=sum(sum(i['size'] for i in entries_for(n,selection[n]).values()) for n in NAMES)
    if total>210*1024*1024:raise ValueError('Source collection over budget')
    root=OUT/name;records={}
    for relative,row in entries_for(name,selection[name]).items():
        if metadata_only and not relative.endswith('.gltf'):continue
        path=root/safe_name(relative)
        if path.exists():data=path.read_bytes()
        else:
            request=urllib.request.Request(row['url'],headers={'User-Agent':'Tidelands-local-asset-review/1.0'})
            context=ssl.create_default_context(cafile='/etc/ssl/cert.pem')
            with urllib.request.urlopen(request,context=context,timeout=45) as response:
                if urllib.parse.urlsplit(response.url).netloc!='dl.polyhaven.org':raise ValueError('Unapproved redirect')
                data=response.read(row['size']+1)
            if len(data)!=row['size'] or hashlib.md5(data).hexdigest()!=row['md5']:raise ValueError('Published checksum mismatch')
            path.parent.mkdir(parents=True,exist_ok=True)
            with path.open('xb') as out:out.write(data)
        if len(data)!=row['size'] or hashlib.md5(data).hexdigest()!=row['md5']:raise FileExistsError('Different existing file')
        records[relative]=dict(bytes=len(data),sha256=hashlib.sha256(data).hexdigest(),publishedMd5=row['md5'],url=row['url'])
    doc=json.loads((root/f'{name}_1k.gltf').read_text())
    allowed=entries_for(name,selection[name])
    for item in doc.get('buffers',[])+doc.get('images',[]):
        if item['uri'] not in allowed:raise ValueError('Unlisted glTF dependency')
    # The bundled Three loader explicitly supports this official UV transform.
    unknown=set(doc.get('extensionsRequired',[]))-{'KHR_texture_transform'}
    if doc.get('skins') or doc.get('animations') or unknown:raise ValueError('Unexpected glTF feature')
    report=dict(name=name,license='CC0-1.0',licensePage='https://polyhaven.com/license',
                sourcePage=f'https://polyhaven.com/a/{name}',credit='Powered by Poly Haven',files=records,
                metadataOnly=metadata_only,productionIntegrated=False,visualAccepted=False,
                requiredExtensions=doc.get('extensionsRequired',[]),
                primitives=[dict(mesh=m.get('name'),material=doc['materials'][p.get('material',0)].get('name'),
                                 triangles=doc['accessors'][p['indices']]['count']//3)
                            for m in doc['meshes'] for p in m['primitives']])
    (root/'acquisition.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({k:report[k] for k in ['name','metadataOnly','primitives','productionIntegrated','visualAccepted']}))

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--name',choices=NAMES,required=True);parser.add_argument('--metadata-only',action='store_true');args=parser.parse_args()
    prepare(args.name,args.metadata_only)
