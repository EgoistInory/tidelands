"""Bind the isolated world probe to actual files; do not promote its open gates."""
from pathlib import Path
import hashlib
import json
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
def read(name):return json.loads((ROOT/'docs'/name).read_text())
def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()

def verify():
    baseline=read('canopy-distance-baseline-scenes.json');coverage=read('canopy-distance-msaa-scenes.json')
    assert len(baseline)==len(coverage)==12
    images=[]
    for before,after in zip(baseline,coverage):
        assert all(before[k]==after[k] for k in ['asset','angle','mode','camera','distance','viewport','buffer'])
        assert before['distance']==45 and after['coverage']=='msaa-opacity'
        assert before['render']['triangles']==after['render']['triangles'] and before['glError']==after['glError']==0
        images.extend([before['image'],after['image']])
    alpha=read('canopy-distance-alpha-diagnostic.json')
    assert len(alpha)==3
    for rows in alpha.values():
        assert .25<rows[0]['coverage']<.27 and rows[-2]['size']==2
        assert rows[-2]['coverage']==rows[-1]['coverage']==0
        assert 0<rows[-1]['mean']<.45
    screen=read('coastal-contact-screening.json');world=read('coastal-world-scenes.json')
    ids=[r['id'] for r in screen['rows']]
    assert len(ids)==len(set(ids))==screen['selectedNodes']==133
    assert screen['exceedsOldBodyEnvelope']==133 and all(r['woodRadiusBelowAvatarHeight']>r['oldBodyRadius'] for r in screen['rows'])
    for name,sha in screen['modelGeometrySha256'].items():
        assert digest(ROOT/'dist/canopy-authored-candidate'/name/f'{name}_near.bin')==sha
    voxel=screen['woodySurfaceVoxels'];voxel_path=ROOT/voxel['path']
    assert voxel_path.stat().st_size==voxel['bytes'] and digest(voxel_path)==voxel['sha256']
    voxel_data=json.loads(voxel_path.read_text());assert voxel_data['cellSize']==.2 and not voxel_data['collisionAccepted']
    for name,data in voxel_data['models'].items():
        assert data['geometrySha256']==screen['modelGeometrySha256'][name]
        cells=data['occupiedCells'];assert len(cells)==voxel['occupiedCells'][name] and len({tuple(r) for r in cells})==len(cells)
        assert all(len(row)==3 and all(isinstance(v,int) for v in row) for row in cells)
    assert len(world)==10
    pairs=[]
    for i in range(0,len(world),2):
        before,after=world[i:i+2]
        assert before['art']=='baseline' and after['art']=='candidate'
        assert before['scene']==after['scene'] and before['camera']==after['camera']
        for row in [before,after]:
            assert row['worldUnchanged'] and row['glError']==0 and row['selectedIds']==ids
            assert row['levels']['near']<=2 and row['levels']['mid']<=6
            assert abs(row['unitFactor']-screen['unitFactor'])<1e-12
            assert not row['productionIntegrated'] and not row['bodyOrBuildCollisionAccepted'] and not row['farLightingAndTransitionAccepted']
            images.append(row['image'])
        pairs.append(dict(scene=after['scene'],cameraMatched=True,callsDelta=after['render']['calls']-before['render']['calls'],trianglesDelta=after['render']['triangles']-before['render']['triangles']))
    wind=read('coastal-world-wind.json')
    assert wind['motion']['frames']==180 and wind['glError']==0 and wind['worldUnchanged']
    assert wind['time']==243 or abs(wind['time']-243)<1e-8
    images.extend(['coastal-world-wind-start.png','coastal-world-wind-final.png'])
    assert len(images)==36 and len(set(images))==36
    for name in images:
        with Image.open(ROOT/'docs'/name) as image:assert image.size==(1280,720)
    assert read('canopy-distance-console.json')==read('coastal-world-console.json')==[]
    tests=(ROOT/'docs/coastal-world-full-tests.txt').read_text()
    assert '# tests 337\n' in tests and '# pass 337\n' in tests and '# fail 0\n' in tests
    package=json.loads((ROOT/'dist/tidelands-m5-2026-10-27-cast-clothing.json').read_text())
    assert len(package['files'])==110
    for name,row in package['files'].items():assert digest(ROOT/('docs/LOCAL-DELIVERY.md' if name=='README.md' else name))==row['sha256']
    report=dict(verified=True,productionIntegrated=False,runtimeInputsUnchanged=110,nativeImagesViewed=36,
                distanceGeometryPairs=6,worldFixturePairs=5,worldPairs=pairs,
                alphaCutoffLossReproduced=True,msaaOpacityDiagnosed=True,farLightingAndTransitionAccepted=False,
                selectedCoastalNodes=133,bodyEnvelopeExceedances=133,bodyCollisionAccepted=False,
                maxWoodRadiusBelowAvatarRange=[min(r['woodRadiusBelowAvatarHeight'] for r in screen['rows']),max(r['woodRadiusBelowAvatarHeight'] for r in screen['rows'])],
                windFrames=180,windMotion=wind['motion'],worldUnitFactor=screen['unitFactor'],
                woodySurfaceVoxels=voxel,ordinarySaveTouched=False,currentGpuOrEnduranceAccepted=False,fullTestsRerun=True,fullTestsPassed=337,
                milestoneM5Complete=False,fullGoalComplete=False,
                images={name:digest(ROOT/'docs'/name) for name in images},
                probeSources={name:digest(ROOT/name) for name in ['tests/authored-canopy-review.js','tests/coastal-canopy-world.html','tests/coastal-canopy-world.js','tools/inspect_coastal_contact.mjs','tools/coastal-wood-voxels.mjs','tests/coastal-wood-voxels.test.js','docs/coastal-world-full-tests.txt']})
    (ROOT/'docs/coastal-world-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({k:v for k,v in report.items() if k not in ['images','probeSources']}))

if __name__=='__main__':verify()
