"""Validate only the separate exact-dedup geometry candidate; no visual acceptance."""
from pathlib import Path
import hashlib,json
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
NAME='jacaranda_tree'
def read(path):return json.loads(path.read_text())
def verify():
    before=ROOT/'dist/inland-authored-candidate';after=ROOT/'dist/inland-authored-dedup-candidate'
    original=read(before/'geometry-manifest.json')['models'][NAME]['levels'];generated=read(after/'geometry-manifest.json')['models'][NAME]['levels'];rows=[]
    for level in ['near','mid']:
        baseline=read(before/NAME/f'{NAME}_{level}.gltf');candidate=read(after/NAME/f'{NAME}_{level}.gltf')
        old=(before/NAME/f'{NAME}_{level}.bin').read_bytes();new=(after/NAME/f'{NAME}_{level}.bin').read_bytes()
        assert len(new)==candidate['buffers'][0]['byteLength']==generated[level]['geometryBytes']
        assert baseline['materials']==candidate['materials'] and baseline['images']==candidate['images']
        def attribute(doc,data,index):
            a=doc['accessors'][index];v=doc['bufferViews'][a['bufferView']];start=v.get('byteOffset',0)+a.get('byteOffset',0)
            assert not v.get('byteStride') and not a.get('sparse')
            size={5125:4,5126:4}[a['componentType']]*{'SCALAR':1,'VEC2':2,'VEC3':3}[a['type']]*a['count']
            assert start+size<=len(data)
            return data[start:start+size]
        for i in [0,2]:
            p=baseline['meshes'][0]['primitives'][i];q=candidate['meshes'][0]['primitives'][i]
            assert p['material']==q['material']
            for semantic,index in p['attributes'].items():assert attribute(baseline,old,index)==attribute(candidate,new,q['attributes'][semantic])
            assert attribute(baseline,old,p['indices'])==attribute(candidate,new,q['indices'])
        trunk=generated[level]['primitives'][1];leaf=generated[level]['primitives'][2]
        assert trunk['removedExactDuplicateFaces']==115056 and 0<trunk['outputTriangles']<230112
        assert trunk['relativeSimplificationError']<=({'near':.004,'mid':.012}[level])
        assert leaf['retainedLeafComponents']==116084
        rows.append(dict(level=level,triangles=generated[level]['triangles'],trunkTriangles=trunk['outputTriangles'],relativeTrunkError=trunk['relativeSimplificationError'],geometryBytes=len(new),savedBytes=len(old)-len(new),sha256=hashlib.sha256(new).hexdigest(),branchAndLeafBuffersIdentical=True))
    diagnosis=read(ROOT/'docs/inland-wood-budget-diagnosis.json');assert diagnosis['verifiedSource'] and not diagnosis['sourceModified'] and not diagnosis['pruneUsed']
    images={}
    for row in rows:
        prefix=ROOT/'docs'/f"inland-dedup-{row['level']}-review";capture=read(prefix.with_suffix('.json'))
        assert capture['ready'] and capture['geometryVariant']=='exact-dedup' and capture['mode']==row['level'] and capture['glError']==0
        assert capture['render']['triangles']==row['triangles']+20393 and capture['viewport']==[1280,720]
        data=prefix.with_suffix('.png').read_bytes()
        with Image.open(prefix.with_suffix('.png')) as image:assert image.size==(1280,720)
        images[row['level']]=hashlib.sha256(data).hexdigest()
    assert read(ROOT/'docs/inland-dedup-console.json')==[]
    report=dict(verified=True,scope='Exact deduplication, unchanged branch/leaf bytes and isolated near/mid display; no full visual quality or production acceptance',removedSameWindingTrunkDuplicates=115056,rows=rows,combinedGeometryBytes=sum(r['geometryBytes'] for r in rows),savedBytes=sum(r['savedBytes'] for r in rows),isolatedImagesViewed=2,images=images,sourceOrPriorCandidateModified=False,productionIntegrated=False,visualAccepted=False,budgetAccepted=False,fullGoalComplete=False)
    (ROOT/'docs/inland-dedup-audit.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
if __name__=='__main__':verify()
