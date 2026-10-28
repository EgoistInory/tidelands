"""Copy the audited inland candidate, validating all inputs before additive writes."""
from pathlib import Path
import hashlib,json
ROOT=Path(__file__).resolve().parents[1]
def read(path):return json.loads((ROOT/path).read_text())
def promote():
    source=ROOT/'dist/inland-authored-component-candidate';output=ROOT/'assets/inland';files={}
    def add(relative,path,digest=None):
        name=Path(relative)
        if name.is_absolute() or '..' in name.parts or path.is_symlink():raise ValueError('Invalid inland asset path')
        data=path.read_bytes()
        if digest and hashlib.sha256(data).hexdigest()!=digest:raise ValueError('Inland source changed: '+relative)
        files[relative]=data
    structure=read('docs/inland-component-structure-audit.json');assert structure['verified']
    textures=read('docs/inland-authored-textures.json')['models']['jacaranda_tree']
    for row in structure['rows']:
        level=row['level'];folder=source/'jacaranda_tree';add(f'jacaranda_tree/jacaranda_tree_{level}.bin',folder/f'jacaranda_tree_{level}.bin',row['sha256']);gltf=folder/f'jacaranda_tree_{level}.gltf';doc=json.loads(gltf.read_text());assert [b['uri'] for b in doc['buffers']]==[f'jacaranda_tree_{level}.bin'];assert not any(n.get(k) for n in doc['nodes'] for k in ['matrix','translation','rotation','scale']);add(f'jacaranda_tree/{gltf.name}',gltf)
        for image in doc['images']:
            relative=image['uri'];add('jacaranda_tree/'+relative,folder/relative,textures[relative]['sha256'])
    for row in read('docs/inland-authored-bake-verification.json')['files']:add('impostors-r1/'+row['file'],ROOT/'dist/inland-authored-candidate/impostors-r1'/row['file'],row['sha256'])
    add('impostor-layout.json',ROOT/'dist/inland-authored-candidate/impostor-layout.json')
    add('inland-contact-shapes.json',ROOT/'dist/inland-authored-contact-candidate/inland-contact-shapes.json',read('docs/inland-contact-cell-preparation.json')['sha256'])
    source_record=read('docs/inland-authored-acquisition.json');assert source_record['license']=='CC0-1.0' and not source_record['metadataOnly']
    files['LICENSE.txt']=b'Jacaranda tree and source textures by Poly Haven contributors. CC0-1.0.\nhttps://polyhaven.com/license\nhttps://polyhaven.com/a/jacaranda_tree\nModified: exact trunk deduplication, component-preserving geometry simplification, 512px textures, four-view impostors and conservative woody contact volumes.\n'
    manifest={'license':source_record['license'],'credit':source_record['credit'],'sourcePage':source_record['sourcePage'],'licensePage':source_record['licensePage'],'derivationEvidence':['docs/inland-authored-acquisition.json','docs/inland-component-audit.json','docs/inland-contact-checkpoint-audit.json','docs/inland-runtime-audit.json'],'files':{name:{'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()} for name,data in sorted(files.items())}}
    files['provenance.json']=(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n').encode()
    for name,data in files.items():
        target=output/name
        if target.is_symlink() or (target.exists() and target.read_bytes()!=data):raise FileExistsError('Refuse different inland runtime file: '+name)
    for name,data in files.items():
        target=output/name;target.parent.mkdir(parents=True,exist_ok=True)
        if not target.exists():target.write_bytes(data)
    report={'verified':True,'files':len(files),'bytes':sum(map(len,files.values())),'sourcePage':source_record['sourcePage'],'sourceChecksumsVerified':True,'productionAssetsCopied':True,'productionStartupAccepted':False};(ROOT/'docs/inland-production-assets.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report))
if __name__=='__main__':promote()
