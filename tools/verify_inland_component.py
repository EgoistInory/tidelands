"""Audit component geometry and bounded single-level static native GPU evidence."""
from pathlib import Path
import hashlib,json,math
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
def read(path):return json.loads((ROOT/path).read_text())
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def verify():
    structure=read('docs/inland-component-structure-audit.json');assert structure['verified'] and structure['sourceLeafComponents']==116084 and structure['sourceExactDuplicateLeafComponents']==0 and not structure['pruneUsed']
    assert structure['sourceSamples']==10067347 and len(structure['rows'])==2
    geometry=read('docs/inland-component-geometry.json');assert geometry==read('dist/inland-authored-component-candidate/geometry-manifest.json')
    levels={r['level']:r for r in structure['rows']};images={}
    for level,row in levels.items():
        folder=ROOT/'dist/inland-authored-component-candidate/jacaranda_tree';assert sha(folder/f'jacaranda_tree_{level}.bin')==row['sha256']
        assert row['serializedLeafComponents']==116084 and row['minComponentTriangles']>=2 and row['woodBytesIdenticalToR2']
        capture=read(f'docs/inland-component-{level}-review.json');assert capture['ready'] and capture['mode']==level and capture['geometryVariant']=='source-components' and capture['glError']==0
        assert capture['render']['triangles']==row['triangles']+20393
        path=ROOT/f'docs/inland-component-{level}-review.png'
        with Image.open(path) as im:assert im.size==(1280,720)
        images[path.name]=sha(path)
    texture=read('docs/inland-authored-textures.json')['models']['jacaranda_tree']
    for relative,row in texture.items():assert sha(ROOT/'dist/inland-authored-component-candidate/jacaranda_tree'/relative)==row['sha256']
    runs=[]
    for suffix,level,viewport,buffer in [('desktop','near',[1280,720],[1920,1080]),('narrow','mid',[390,844],[390,844])]:
        run=read(f'docs/inland-component-gpu-{suffix}.json');assert run['complete'] and run['supported'] and not run['hidden'] and run['disjointCount']==0 and run['timerBits']>0
        assert run['loaded3DLevel']==level and run['resourceLODs']==[level] and run['shared3DGeometries']==3 and run['single3DGeometryBytes']==levels[level]['geometryBytes']
        assert run['viewport']==run['canvasCssSize']==viewport and run['buffer']==buffer
        assert [r['representation'] for r in run['rows']]==['old','candidate','mesh-candidate']
        for row in run['rows']:
            values=row['gpuRawMs'];assert len(values)==60 and all(math.isfinite(v) and v>0 for v in values) and row['glError']==0
            sorted_values=sorted(values);assert abs(row['gpuMs']['p95']-sorted_values[57])<1e-9 and abs(row['gpuMs']['max']-sorted_values[-1])<1e-9
            assert row['camera']==run['rows'][0]['camera'] and row['player']==[164,-92]
        a,b,c=run['rows'];assert a['visible3DCount']==b['visible3DCount']==0 and c['visible3DCount']==1 and c['visible3DId']=='resource-1765'
        assert c['triangles']-b['triangles']==levels[level]['triangles']-2
        state=read('docs/inland-component-world-'+('near' if level=='near' else 'mid')+'.json');assert state['originalWorldObjectsUnchanged'] and state['selectedCount']==15 and state['originalCoastalIds']==133
        assert read(f'docs/inland-component-gpu-{suffix}-console.json')==[]
        path=ROOT/f'docs/inland-component-gpu-{suffix}.png'
        with Image.open(path) as im:assert list(im.size)==viewport
        images[path.name]=sha(path)
        runs.append(dict(viewport=viewport,buffer=buffer,loaded3DLevel=level,single3DGeometryBytes=run['single3DGeometryBytes'],nativeQueries=180,gpuP95Ms={r['representation']:r['gpuMs']['p95'] for r in run['rows']},gpuMaxMs=max(r['gpuMs']['max'] for r in run['rows']),jsHeapBytes=run['jsHeapBytes']))
    assert read('docs/inland-component-isolated-console.json')==[]
    package=read('dist/tidelands-m5-2026-10-27-coastal-contact-budget.json')
    for relative,row in package['files'].items():assert sha(ROOT/('docs/LOCAL-DELIVERY.md' if relative=='README.md' else relative))==row['sha256']
    report=dict(verified=True,scope='Serialized geometry, isolated captures and static native render intervals; not whole-game acceptance',sourceLeafComponentsPreserved=116084,sourceSamples=structure['sourceSamples'],combinedCandidateGeometryBytes=structure['combinedGeometryBytes'],savedBytesVsR2=210532568-structure['combinedGeometryBytes'],nativeStaticGpuQueriesVerified=360,single3DLevelLoadDemonstrated=True,maxVisibleMature3DTrees=1,staticImagesViewed=4,runs=runs,productionRuntimeFilesUnchanged=len(package['files']),packageSha256=package['archiveSha256'],productionIntegrated=False,terrainRootSupportAccepted=False,lowWoodContactAccepted=False,farLightingMatchAccepted=False,cpuGameLoopOrEnduranceAccepted=False,vramOrPhysicalDeviceAccepted=False,milestoneM5Complete=False,fullGoalComplete=False,images=images,sources={p:sha(ROOT/p) for p in ['tools/build_inland_lod.mjs','tools/leaf-component-decimation.mjs','tests/inland-world-candidate.js','tests/inland-world-candidate.html','tests/inland-authored-review.js']})
    (ROOT/'docs/inland-component-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps({k:v for k,v in report.items() if k not in ['images','sources']},ensure_ascii=False))
if __name__=='__main__':verify()
