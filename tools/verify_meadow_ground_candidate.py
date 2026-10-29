"""Scoped proof of visible-triangle decorative support; production stays frozen."""
from pathlib import Path
import hashlib,json
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
def read(p):return json.loads((ROOT/p).read_text())
def sha(p):return hashlib.sha256((ROOT/p).read_bytes()).hexdigest()
def verify():
    baseline=read('docs/meadow-visible-support-audit.json');candidate=read('docs/meadow-root-candidate-audit.json')
    assert baseline['verified'] and baseline['rowCount']==105636 and baseline['rayChecks']==70 and baseline['maxRayError']<1e-5
    assert sha(baseline['rawPath'])==baseline['rawSha256']
    raw=read(baseline['rawPath']);assert len(raw['rows'])==105636
    for p,h in baseline['sourceHashes'].items():assert sha(p)==h
    assert baseline['groups']['meadow-grass']['grossFloat']==241
    assert baseline['groups']['meadow-grass']['maxRootGap']>.34
    assert candidate['verified'] and not candidate['productionIntegrated'] and candidate['nonYValuesIdentical']==1584540
    assert candidate['after']['instances']==candidate['before']['instances']==105636
    assert candidate['after']['maxRootGap']<-.0349 and candidate['after']['minRootGap']<-.54
    for g in candidate['groups'].values():assert g['fullyBuriedBefore']==g['fullyBuriedAfter']==0
    package=read('dist/tidelands-m5-2026-10-29-berry-runtime.json');assert len(package['files'])==208
    for p,h in package['files'].items():assert sha('docs/LOCAL-DELIVERY.md' if p=='README.md' else p)==h['sha256'],p
    assert package['archiveSha256']==sha('dist/tidelands-m5-2026-10-29-berry-runtime.zip')=='edb40edf0b8ae3cb6994732998839062da1de6d6e2a0f299c91476086bbbac57'
    assert sha('docs/beacon-footing-normal-save.json')=='33455473ff0e92097db6351e2ea421e498accde405ee5a9482ae8ef16d55bb29'
    rows=read('docs/meadow-root-native.json');assert len(rows)==6
    for r in rows:assert r['ready'] and r['worldUnchanged'] and r['stateUnchanged'] and r['glError']==0 and r['before']==candidate['before'] and r['after']==candidate['after']
    for site in ['ridge','slope','coast']:
        pair=[r for r in rows if r['site']==site];assert len(pair)==2 and {r['enabled'] for r in pair}=={False,True}
        a,b=pair;assert a['camera']==b['camera'] and a['point']==b['point'] and a['buffer']==b['buffer']
        assert abs(a['renderer']['calls']-b['renderer']['calls'])<=1
    assert read('docs/meadow-root-console.json')==[]
    images={}
    for r in rows:
        p='docs/meadow-root-'+r['name']+'.png'
        with Image.open(ROOT/p) as im:assert im.size==(1280,720);im.verify()
        images[p]=sha(p)
    log=(ROOT/'docs/meadow-ground-support-green.txt').read_text();assert '# pass 2' in log and '# fail 0' in log
    alltests=(ROOT/'docs/meadow-ground-support-full-tests.txt').read_text();assert '# tests 377' in alltests and '# fail 0' in alltests
    report={'verified':True,'productionIntegrated':False,'runtimeInputsUnchanged':208,'packageSha256':package['archiveSha256'],'rootInstances':105636,'grassGrossFloatBefore':241,'maxRootGapBefore':candidate['before']['maxRootGap'],'maxRootGapAfter':candidate['after']['maxRootGap'],'minimumRootGapAfter':candidate['after']['minRootGap'],'fullyBuriedInstancesAfter':sum(g['fullyBuriedAfter'] for g in candidate['groups'].values()),'nonYMatrixValuesIdentical':1584540,'independentRayChecks':70,'nativeSameCameraPairs':3,'images':images,'focusedTests':2,'fullTests':377,'newOrdinarySaveTouched':False,'currentGpuOrEnduranceAccepted':False,'wholeLandscapeQualityAccepted':False,'milestoneM5Complete':False,'fullGoalComplete':False,'scope':'Isolated actual-terrain decorative support fix. Fallback backgrounds/hidden actor/close diagnostic camera, nominal roots/vertices only. Some roots remain deeply buried, no whole-clump nominal burial. Not authored whole scene, production migration, normal main path, GPU or mobile proof.'}
    (ROOT/'docs/meadow-ground-candidate-checkpoint.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps({k:v for k,v in report.items() if k!='images'},ensure_ascii=False))
if __name__=='__main__':verify()
