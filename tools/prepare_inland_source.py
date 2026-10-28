"""Acquire the already selected full-height inland tree, never alter runtime assets."""
from pathlib import Path
import argparse,hashlib,json,re,ssl,urllib.parse,urllib.request
from prepare_forest_collection import safe_name
ROOT=Path(__file__).resolve().parents[1]
NAME='jacaranda_tree'
def inland_entries(name,row):
    if name!=NAME:raise ValueError('Unapproved inland model')
    entries={f'{name}_1k.gltf':row,**row.get('include',{})}
    for relative,item in entries.items():
        safe_name(relative);url=urllib.parse.urlsplit(item['url'])
        if url.scheme!='https' or url.netloc!='dl.polyhaven.org' or not url.path.startswith('/file/ph-assets/Models/') or f'/{NAME}/' not in url.path:raise ValueError('Unapproved inland source')
        if Path(relative).suffix not in ['.gltf','.bin','.jpg','.png'] or not isinstance(item['size'],int) or not 0<item['size']<=220*1024*1024 or not re.fullmatch('[a-f0-9]{32}',item['md5']):raise ValueError('Invalid file budget or checksum')
    if sum(item['size'] for item in entries.values())>240*1024*1024:raise ValueError('Inland collection over budget')
    return entries
def prepare(metadata_only=False):
    row=json.loads((ROOT/'docs/inland-authored-source-selection.json').read_text())[NAME];entries=inland_entries(NAME,row);root=ROOT/'dist/inland-authored-source'/NAME;records={}
    for relative,item in entries.items():
        if metadata_only and not relative.endswith('.gltf'):continue
        path=root/safe_name(relative)
        if path.exists():data=path.read_bytes()
        else:
            request=urllib.request.Request(item['url'],headers={'User-Agent':'Tidelands-local-asset-review/1.0'})
            with urllib.request.urlopen(request,context=ssl.create_default_context(cafile='/etc/ssl/cert.pem'),timeout=45) as response:
                if urllib.parse.urlsplit(response.url).netloc!='dl.polyhaven.org':raise ValueError('Unapproved redirect')
                data=response.read(item['size']+1)
            if len(data)!=item['size'] or hashlib.md5(data).hexdigest()!=item['md5']:raise ValueError('Published source checksum mismatch')
            path.parent.mkdir(parents=True,exist_ok=True)
            with path.open('xb') as out:out.write(data)
        if len(data)!=item['size'] or hashlib.md5(data).hexdigest()!=item['md5']:raise FileExistsError('Different existing inland file')
        records[relative]={'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'publishedMd5':item['md5'],'url':item['url']}
        print(json.dumps({'file':relative,'verifiedBytes':len(data)}),flush=True)
    doc=json.loads((root/f'{NAME}_1k.gltf').read_text())
    if doc.get('skins') or doc.get('animations') or set(doc.get('extensionsRequired',[]))-{'KHR_texture_transform'}:raise ValueError('Unsupported source feature')
    for dep in doc.get('buffers',[])+doc.get('images',[]):
        if dep['uri'] not in entries:raise ValueError('Unlisted inland glTF dependency')
    report={'name':NAME,'license':'CC0-1.0','licensePage':'https://polyhaven.com/license','sourcePage':f'https://polyhaven.com/a/{NAME}','credit':'Powered by Poly Haven','metadataOnly':metadata_only,'files':records,'productionIntegrated':False,'visualAccepted':False,'primitives':[{'material':doc['materials'][p['material']]['name'],'triangles':doc['accessors'][p['indices']]['count']//3} for mesh in doc['meshes'] for p in mesh['primitives']]}
    (root/'acquisition.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({k:report[k] for k in ['name','metadataOnly','primitives','productionIntegrated','visualAccepted']}))
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--metadata-only',action='store_true');args=parser.parse_args();prepare(args.metadata_only)
