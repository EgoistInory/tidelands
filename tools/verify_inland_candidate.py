"""Verify acquired source and isolated evidence; never promote this candidate."""
from pathlib import Path
import hashlib,json
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
NAME='jacaranda_tree'
def read(path):return json.loads((ROOT/path).read_text())
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def verify():
    acquisition=read('docs/inland-authored-acquisition.json')
    assert acquisition==read(f'dist/inland-authored-source/{NAME}/acquisition.json')
    assert not acquisition['metadataOnly'] and len(acquisition['files'])==12
    source_bytes=0
    for relative,row in acquisition['files'].items():
        data=(ROOT/'dist/inland-authored-source'/NAME/relative).read_bytes()
        assert len(data)==row['bytes'] and hashlib.md5(data).hexdigest()==row['publishedMd5'] and hashlib.sha256(data).hexdigest()==row['sha256']
        source_bytes+=len(data)
    assert source_bytes==215115342
    geometry=read('docs/inland-authored-geometry.json')
    assert geometry==read('dist/inland-authored-candidate/geometry-manifest.json')
    model=geometry['models'][NAME];assert model['sourceLeafComponents']==116084 and model['neutralColor0Verified']
    assert not geometry['tool']['pruneUsed'] and not geometry['productionIntegrated']
    candidates={}
    for level,row in model['levels'].items():
        assert len(row['primitives'])==3
        leaf=row['primitives'][2];assert leaf['retainedLeafComponents']==116084 and leaf['fallbackLeaves']==79160 and leaf['maxLeafFitError']<=.009
        for suffix in ['gltf','bin']:
            path=ROOT/'dist/inland-authored-candidate'/NAME/f'{NAME}_{level}.{suffix}'
            candidates[str(path.relative_to(ROOT))]=dict(bytes=path.stat().st_size,sha256=sha(path))
        assert candidates[f'dist/inland-authored-candidate/{NAME}/{NAME}_{level}.bin']['bytes']==row['geometryBytes']
        doc=read(f'dist/inland-authored-candidate/{NAME}/{NAME}_{level}.gltf')
        assert doc['buffers'][0]['byteLength']==row['geometryBytes']
        assert sum(doc['accessors'][p['indices']]['count']//3 for p in doc['meshes'][0]['primitives'])==row['triangles']
        assert doc['materials'][2]['alphaMode']=='MASK' and doc['materials'][2]['alphaCutoff']==.45
    textures=read('docs/inland-authored-textures.json');assert textures==read('dist/inland-authored-candidate/texture-manifest.json')
    for relative,row in textures['models'][NAME].items():
        path=ROOT/'dist/inland-authored-candidate'/NAME/relative;assert sha(path)==row['sha256']
        with Image.open(path) as im:assert list(im.size)==row['size']
    bake=read('docs/inland-authored-bake-verification.json');assert bake['verified'] and len(bake['files'])==8
    for row in bake['files']:assert sha(ROOT/bake['folder']/row['file'])==row['sha256']
    modes={'near':'near','source':'source','mid':'mid','mass':'mass','far':'far','far-90':'far','far-180':'far','far-270':'far','far-mass':'far-mass'}
    evidence={}
    for key,mode in modes.items():
        prefix=f'docs/inland-{key}-review';row=read(prefix+'.json')
        assert row['ready'] and row['mode']==mode and row['glError']==0 and row['viewport']==[1280,720]
        assert abs(row['sharedUnit']-2.95/1.8195863831788301)<1e-12 and 31<row['candidateWorldSize'][1]<32
        assert 2.9<row['personHeight']<3.1
        with Image.open(ROOT/(prefix+'.png')) as im:assert im.size==(1280,720)
        evidence[key]=dict(mode=mode,triangles=row['render']['triangles'],imageSha256=sha(ROOT/(prefix+'.png')))
    assert evidence['far-mass']['triangles']==evidence['far']['triangles']+8
    failed=read('docs/inland-far-mass-hidden-attempt.json');assert failed['render']['triangles']<evidence['far']['triangles']
    assert read('docs/inland-isolated-console.json')==[]
    world_evidence={}
    for place in ['edge','interior']:
        rows=[]
        for mode in ['old','candidate']:
            prefix=f'docs/inland-world-{place}-{mode}';row=read(prefix+'.json');rows.append(row)
            assert row['ready'] and row['place']==place and row['representation']==mode and row['originalWorldObjectsUnchanged']
            assert row['selectedCount']==len(set(row['selectedIds']))==15 and row['originalCoastalIds']==133 and row['glError']==0
            with Image.open(ROOT/(prefix+'.png')) as im:assert im.size==(1280,720)
            world_evidence[f'{place}-{mode}']=dict(imageSha256=sha(ROOT/(prefix+'.png')),triangles=row['render']['triangles'])
        for field in ['selectedIds','selectedOriginalPositions','camera','player','time']:assert rows[0][field]==rows[1][field]
    assert read('docs/inland-world-console.json')==[]
    package=read('dist/tidelands-m5-2026-10-27-coastal-contact-budget.json')
    for relative,row in package['files'].items():assert sha(ROOT/('docs/LOCAL-DELIVERY.md' if relative=='README.md' else relative))==row['sha256']
    report=dict(verified=True,verificationScope='Published source bytes, derived files and diagnostic capture consistency only',sourceFiles=12,sourceBytes=source_bytes,originalTriangles=sum(p['triangles'] for p in acquisition['primitives']),sourceAcquired=True,isolatedRepresentationExecuted=True,allLeafComponentsRetained=116084,nearTriangles=model['levels']['near']['triangles'],midTriangles=model['levels']['mid']['triangles'],combinedGeometryBytes=sum(r['geometryBytes'] for r in model['levels'].values()),bakedViews=4,bakedFiles=8,bakedBytes=sum(r['bytes'] for r in bake['files']),isolatedImagesViewed=9,worldCandidateImagesViewed=4,worldCandidateOriginalIds=15,failedHiddenMassAttemptPreserved=True,productionRuntimeFilesUnchanged=len(package['files']),currentPackageSha256=package['archiveSha256'],productionIntegrated=False,inland3dBudgetAccepted=False,farLightingMatchAccepted=False,wholeProductionForestAccepted=False,ordinarySaveTouched=False,gpuOrEnduranceAccepted=False,physicalDeviceAccepted=False,milestoneM5Complete=False,fullGoalComplete=False,candidates=candidates,evidence=evidence,worldEvidence=world_evidence)
    (ROOT/'docs/inland-candidate-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({k:v for k,v in report.items() if k not in ['candidates','evidence','worldEvidence']},ensure_ascii=False))
if __name__=='__main__':verify()
