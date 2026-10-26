"""Audit actual source files and isolated representations without accepting world integration."""
from pathlib import Path
import array
import hashlib
import json
import math
import sys
from PIL import Image
from verify_canopy_bake import verify as verify_bakes

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'dist/canopy-authored-source'
OUT=ROOT/'dist/canopy-authored-candidate'
NAMES=['island_tree_01','island_tree_02','island_tree_03']
sha=lambda data:hashlib.sha256(data).hexdigest()

def verify():
    source_records={};source_bytes=0;source_files=0
    topology=json.loads((ROOT/'docs/canopy-authored-topology.json').read_text())
    geometry=json.loads((OUT/'geometry-manifest.json').read_text())
    textures=json.loads((OUT/'texture-manifest.json').read_text())
    assert geometry['tool']['pruneUsed'] is False
    for name in NAMES:
        acquired=json.loads((SOURCE/name/'acquisition.json').read_text())
        assert acquired['metadataOnly'] is False and len(acquired['files'])==12
        for relative,row in acquired['files'].items():
            data=(SOURCE/name/relative).read_bytes()
            assert len(data)==row['bytes'] and sha(data)==row['sha256'] and hashlib.md5(data).hexdigest()==row['publishedMd5']
            source_bytes+=len(data);source_files+=1
        source_records[name]=acquired
        components=topology['models'][name]['primitives'][1]['components']
        assert geometry['models'][name]['sourceLeafComponents']==components
        for level,triangles_per_leaf in [('near',4),('mid',2)]:
            doc=json.loads((OUT/name/f'{name}_{level}.gltf').read_text());data=(OUT/name/doc['buffers'][0]['uri']).read_bytes()
            assert len(data)==doc['buffers'][0]['byteLength']==geometry['models'][name]['levels'][level]['geometryBytes']
            for view in doc['bufferViews']:assert 0<=view.get('byteOffset',0)<=view.get('byteOffset',0)+view['byteLength']<=len(data)
            arrays=[]
            for accessor in doc['accessors']:
                view=doc['bufferViews'][accessor['bufferView']];start=view.get('byteOffset',0);width={'SCALAR':1,'VEC2':2,'VEC3':3}[accessor['type']]
                values=array.array('f' if accessor['componentType']==5126 else 'I',data[start:start+accessor['count']*width*4])
                if sys.byteorder!='little':values.byteswap()
                assert len(values)==accessor['count']*width
                if accessor['componentType']==5126:assert all(math.isfinite(v) for v in values)
                arrays.append(values)
            primitives=doc['meshes'][0]['primitives']
            assert sum(len(arrays[p['indices']])//3 for p in primitives)==geometry['models'][name]['levels'][level]['triangles']
            for primitive in primitives:assert max(arrays[primitive['indices']])<doc['accessors'][primitive['attributes']['POSITION']]['count']
            assert len(arrays[primitives[1]['indices']])//3==components*triangles_per_leaf
            leaf=geometry['models'][name]['levels'][level]['primitives'][1]
            assert leaf['retainedLeafComponents']==components and leaf['fallbackLeaves']==0 and leaf['maxLeafFitError']<.009
        for relative,row in textures['models'][name].items():
            data=(OUT/name/relative).read_bytes();assert sha(data)==row['sha256']
            with Image.open(OUT/name/relative) as image:
                assert image.size==(512,512)
                if relative.endswith('.png'):assert image.getchannel('A').getextrema()==(0,255)
    assert source_files==36 and source_bytes==197567454
    (ROOT/'docs/canopy-authored-acquisition.json').write_text(json.dumps(source_records,indent=2)+'\n')
    verify_bakes(OUT/'impostors-r3')
    bakes=json.loads((ROOT/'docs/canopy-authored-bake-r3.json').read_text())
    for row in bakes['files']:assert sha((OUT/'impostors-r3'/row['file']).read_bytes())==row['sha256']
    r2=json.loads((ROOT/'docs/canopy-authored-r2-scenes.json').read_text());distance=json.loads((ROOT/'docs/canopy-authored-r4-distance-scenes.json').read_text())
    accepted=[r for r in r2 if r['mode']!='far']+distance
    assert len(accepted)==30 and all(r['glError']==0 and r['personPlan']['speed']==0 for r in accepted)
    images=[]
    for name in NAMES:
        for angle in [0,90]:
            rows=[r for r in r2 if r['asset']==name and r['angle']==angle and r['mode']!='far']
            assert len(rows)==3 and all(r['camera']==rows[0]['camera'] for r in rows)
            assert rows[0]['render']['triangles']>rows[1]['render']['triangles']>rows[2]['render']['triangles']
            far_rows=[r for r in distance if r['asset']==name and r['angle']==angle]
            assert len(far_rows)==2 and all(r['distance']==45 and r['camera']==far_rows[0]['camera'] for r in far_rows)
            assert far_rows[1]['render']['triangles']==20395
            images.extend([ROOT/'docs'/f'canopy-authored-r2-{name}-{angle}-{mode}.jpg' for mode in ['source','near','mid']])
            images.extend([ROOT/'docs'/f'canopy-authored-r4-{name}-{angle}-{mode}.jpg' for mode in ['near','far']])
    assert len(images)==30 and all(p.stat().st_size>10000 for p in images)
    assert len(list((ROOT/'docs').glob('canopy-authored-*.jpg')))==60
    assert json.loads((ROOT/'docs/canopy-authored-console.json').read_text())==[]
    package=json.loads((ROOT/'dist/tidelands-m5-2026-10-27-cast-clothing.json').read_text())
    for name,row in package['files'].items():assert sha((ROOT/('docs/LOCAL-DELIVERY.md' if name=='README.md' else name)).read_bytes())==row['sha256']
    report=dict(verified=True,sourceFiles=source_files,sourceBytes=source_bytes,sourceTreeModels=3,
                retainedLeafComponents=sum(geometry['models'][n]['sourceLeafComponents'] for n in NAMES),
                sourceTopology=topology['models'],geometry=geometry['models'],textureBytes=textures['textureBytes'],
                bakedViews=12,bakedFiles=24,bakedBytes=sum(r['bytes'] for r in bakes['files']),
                nativeImagesSaved=60,nativeImagesViewed=48,acceptedDiagnosticImagesViewed=30,
                sourceAcquired=True,nearMidGeometryReviewed=True,farImageFormatVerified=True,
                farLightingOrTransitionAccepted=False,worldWindOrCollisionIntegrated=False,sourcePhysicalScaleInGameAccepted=False,
                productionIntegrated=False,runtimeInputsUnchanged=110,ordinarySaveTouched=False,
                currentGpuOrEnduranceAccepted=False,realDeviceVerified=False,
                milestoneM5Complete=False,fullGoalComplete=False,
                images={p.name:sha(p.read_bytes()) for p in images})
    (ROOT/'docs/canopy-authored-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({k:v for k,v in report.items() if k not in ['sourceTopology','geometry','images']}))

if __name__=='__main__':verify()
