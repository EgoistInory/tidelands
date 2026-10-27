"""Audit the isolated contact increment and its actual main-input evidence."""
from pathlib import Path
import hashlib,json
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
def load(name):return json.loads((ROOT/'docs'/name).read_text())
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def verify():
    package=json.loads((ROOT/'dist/tidelands-m5-2026-10-27-cast-clothing.json').read_text())
    for name,row in package['files'].items():assert sha(ROOT/('docs/LOCAL-DELIVERY.md' if name=='README.md' else name))==row['sha256']
    for rev in ['r0','r1','r2']:
        manifest=load(f'coastal-contact-{rev}-source.json');folder=Path(manifest['path'])
        for name,row in manifest['files'].items():assert sha(folder/name)==row['sha256'] and (folder/name).stat().st_size==row['bytes']
    final=load('coastal-contact-r2-source.json');assert set(final['changed'])=={'src/game.js','src/main.js','src/impact-feedback.js','src/resource-contact.js','src/resource-footprint.js'}
    helper=(ROOT/'tests/coastal-resource-footprint.js').read_text().replace("'../src/world.js'","'./world.js'").replace("'../src/action-timing.js'","'./action-timing.js'")
    assert (Path(final['path'])/'src/resource-footprint.js').read_text()==helper
    for file,expected in [('coastal-contact-full-tests.txt',345),('coastal-contact-candidate-legacy.txt',67),('coastal-contact-r2-integration.txt',6),('coastal-contact-focused.txt',8)]:
        text=(ROOT/'docs'/file).read_text();assert f'# pass {expected}\n' in text and '# fail 0\n' in text
    for name,digest in load('coastal-contact-legacy-test-sources.json').items():assert sha(ROOT/'tests'/name)==sha(Path(final['path'])/'tests'/name)==digest
    rows=load('coastal-contact-main-legal-rows.json');r={v['label']:v for v in rows};build=load('coastal-contact-main-build-rows.json');b={v['label']:v for v in build}
    for row in rows+build:assert row['glError']==0 and row['worldUnchanged'] and row['coastalNodes']==133 and row['fixtureRevision']==2
    start=r['legal-branch-start'];blocked=r['legal-branch-blocked'];cut=r['legal-branch-gathered'];passed=r['legal-depleted-passage'];saved=r['legal-saved'];resumed=r['legal-resumed'];grown=r['legal-natural-regrowth']
    assert start['player']['x']==blocked['player']['x'] and start['player']['z']==blocked['player']['z']
    assert cut['inventory']['wood']==start['inventory']['wood']+3 and cut['targetDepleted'] and not cut['targetVisible']
    assert cut['gatherTarget'] and abs(cut['gatherTarget']['z']-load('coastal-contact-fixtures.json')['branch']['target']['z'])<1e-8
    assert passed['player']['z']-cut['player']['z']>4 and passed['targetDepleted']
    before=json.loads(saved['serializedState']);after=json.loads(resumed['serializedState'])
    for key in ['player','inventory','buildings','depleted','quest','kills','time','respawn','selected']:assert before[key]==after[key]
    assert len(after['enemies'])==79 and all(e['hp']==0 for e in after['enemies'])
    assert grown['time']>grown['depleted']['resource-3'] and grown['targetVisible'] and not grown['targetDepleted']
    assert grown['player']==resumed['player']
    reject=b['depleted-build-rejected'];assert '恢复' in reject['placement']['error'] and reject['buildings']==[] and reject['inventory']==b['depleted-build-before']['inventory']
    clear=b['clear-built'];assert len(clear['buildings'])==1 and clear['inventory']['wood']==25 and clear['inventory']['stone']==27
    old=b['legacy-before'];rest=b['legacy-rested'];assert old['player']['hp']==62 and rest['player']['hp']==100 and rest['targetDepleted'] and not rest['targetVisible']
    assert old['buildings']==rest['buildings'] and old['depleted']==rest['depleted'] and old['inventory']==rest['inventory'] and rest['time']>rest['depleted']['resource-16']
    overlap=b['overlap-before'];escape=b['overlap-outward'];assert abs(overlap['targetReach']-1.8)<1e-8 and escape['player']['z']<overlap['player']['z']-4
    assert load('coastal-contact-main-console.json')==load('coastal-contact-build-console.json')==[]
    images=['coastal-contact-legal-'+n+'.png' for n in ['blocked','gathered','passage','saved','resumed','regrown']]+['coastal-contact-'+n+'.png' for n in ['depleted-build-rejected','clear-built','legacy-before','legacy-rested','overlap-outward']]
    for name in images:
        with Image.open(ROOT/'docs'/name) as im:assert im.size==(1280,720)
    report=dict(verified=True,isolatedContactIncrementAccepted=True,productionIntegrated=False,runtimeInputsUnchanged=110,candidateRuntimeInputs=len(final['files']),candidateChangedFiles=final['changed'],fullTestsPassed=345,candidateLegacyTestsPassed=67,candidateIntegrationTestsPassed=6,newGeometryContractsPassed=8,nativeMainImagesViewed=11,
                bodyBlockedOnActualWood=True,gatheredWoodDelta=3,depletedPassageDelta=passed['player']['z']-cut['player']['z'],nativeNineSavedFieldsRestored=True,naturalSimulationRegrowthObserved=True,regrowthDeadline=grown['depleted']['resource-3'],regrowthObservedAt=grown['time'],oldCampRestHp=[62,100],overlapOutwardDelta=escape['player']['z']-overlap['player']['z'],mergedBoxes=load('coastal-contact-fixtures.json')['mergedBoxes'],
                initialGrazingFixtureRejected=True,initialInvalidCreatureRosterSaveRejected=True,realOrdinarySaveTouched=False,currentGpuOrEnduranceAccepted=False,farLightingOrTransitionAccepted=False,physicalDeviceVerified=False,milestoneM5Complete=False,fullGoalComplete=False,
                images={name:sha(ROOT/'docs'/name) for name in images},sources={name:sha(ROOT/name) for name in ['tests/coastal-resource-footprint.js','tests/coastal-contact-main.html','tests/coastal-contact-visual.js','tools/prepare_coastal_contact_candidate.py','tools/prepare_coastal_contact_fixtures.mjs']})
    (ROOT/'docs/coastal-contact-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps({k:v for k,v in report.items() if k not in ['images','sources']}))
if __name__=='__main__':verify()
